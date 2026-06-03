import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, MessageSquare, Plus, Folder, Share2, Paperclip, Send, FileText,
  ChevronDown, ArrowLeft, RefreshCw, X
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

const Learn = () => {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [resources, setResources] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResourceList, setShowResourceList] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  const activeConv = conversations.find((c) => c.id === activeConvId);

  useEffect(() => {
    fetchClassrooms();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages?.length, isSubmitting]);

  useEffect(() => {
    if (selectedClassroom) {
      fetchSessions(selectedClassroom.id);
      fetchResources(selectedClassroom.id);
      setActiveConvId(null);
    }
  }, [selectedClassroom]);

  const fetchClassrooms = async () => {
    try {
      const res = await api.get("/classrooms/");
      const list = res.data.classrooms || [];
      setClassrooms(list);
      if (list.length > 0 && !selectedClassroom) {
        setSelectedClassroom(list[0]);
      }
    } catch {
      toast.error("Failed to load classrooms");
    }
  };

  const fetchSessions = async (classroomId) => {
    setLoadingSessions(true);
    try {
      const res = await api.get(`/classrooms/${classroomId}/chat/sessions`);
      const sessions = (res.data.sessions || []).map((s) => ({
        id: s.id,
        title: s.title || "New Conversation",
        classroomId: classroomId,
        timeCategory: "Today",
        messages: [],
        message_count: s.message_count || 0,
      }));
      setConversations(sessions);
      if (sessions.length > 0) {
        setActiveConvId(sessions[0].id);
        fetchMessages(sessions[0].id, classroomId);
      }
    } catch {
      toast.error("Failed to load conversations");
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchMessages = async (sessionId, classroomId) => {
    try {
      const res = await api.get(`/classrooms/${classroomId}/chat/sessions/${sessionId}`);
      const msgs = (res.data.messages || []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.created_at
          ? new Date(m.created_at).toLocaleTimeString()
          : "",
      }));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === sessionId ? { ...c, messages: msgs } : c
        )
      );
    } catch {
      toast.error("Failed to load messages");
    }
  };

  const fetchResources = async (classroomId) => {
    try {
      const res = await api.get(`/classrooms/${classroomId}/resources`);
      setResources(res.data.resources || []);
    } catch {
      // silent
    }
  };

  const handleSelectConv = (id) => {
    setActiveConvId(id);
    const conv = conversations.find((c) => c.id === id);
    if (conv && conv.messages.length === 0 && selectedClassroom) {
      fetchMessages(id, selectedClassroom.id);
    }
  };

  const handleNewConversation = async () => {
    if (!selectedClassroom) return;
    try {
      const res = await api.post(`/classrooms/${selectedClassroom.id}/chat/sessions`, {});
      const session = res.data.session;
      const newConv = {
        id: session.id,
        title: session.title || "New Conversation",
        classroomId: selectedClassroom.id,
        timeCategory: "Today",
        messages: [],
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConvId(session.id);
    } catch {
      toast.error("Failed to create conversation");
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSubmitting || !selectedClassroom || !activeConvId) return;

    const userText = inputMessage;
    setInputMessage("");

    const userMsg = {
      id: "msg-user-" + Date.now(),
      role: "user",
      content: userText,
      timestamp: new Date().toLocaleTimeString(),
    };

    let updatedMsgs = [...(activeConv?.messages || []), userMsg];
    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id === activeConvId) {
          const title =
            conv.messages.length === 0
              ? userText.length > 25
                ? userText.slice(0, 25) + "..."
                : userText
              : conv.title;
          return { ...conv, messages: updatedMsgs, title };
        }
        return conv;
      })
    );

    setIsSubmitting(true);

    try {
      const res = await api.post(
        `/classrooms/${selectedClassroom.id}/chat/sessions/${activeConvId}/messages`,
        { query: userText }
      );

      const aiMsg = {
        id: "msg-ai-" + Date.now(),
        role: "assistant",
        content: res.data.response,
        timestamp: new Date().toLocaleTimeString(),
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeConvId) {
            return {
              ...c,
              messages: [...c.messages, aiMsg],
              title: res.data.session?.title || c.title,
            };
          }
          return c;
        })
      );
    } catch (err) {
      const errorMsg = {
        id: "msg-err-" + Date.now(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toLocaleTimeString(),
      };
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeConvId) {
            return { ...c, messages: [...c.messages, errorMsg] };
          }
          return c;
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClassroom) return;
    toast.info("File upload is handled via the Resources tab in the classroom.");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClassroomChange = (classroomId) => {
    const match = classrooms.find((c) => c.id === Number(classroomId));
    if (match) setSelectedClassroom(match);
  };

  const activeResources = resources;

  const renderMarkdown = (text) => {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parsedLine = line.replace(boldRegex, "<strong>$1</strong>");

      if (line.match(/^[\d]+\.\s/)) {
        return (
          <div key={idx} className="flex gap-2 text-sm leading-relaxed py-0.5">
            <span className="text-[#4A7C59] font-medium">•</span>
            <span dangerouslySetInnerHTML={{ __html: parsedLine.replace(/^[\d]+\.\s/, "") }} />
          </div>
        );
      }
      if (line.match(/^\*\s+/)) {
        return (
          <div key={idx} className="flex gap-2 text-sm leading-relaxed py-0.5">
            <span className="text-[#4A7C59]">•</span>
            <span dangerouslySetInnerHTML={{ __html: parsedLine.replace(/^\*\s+/, "") }} />
          </div>
        );
      }
      if (line.match(/^- /)) {
        return (
          <div key={idx} className="flex gap-2 text-sm leading-relaxed py-0.5">
            <span className="text-[#4A7C59]">•</span>
            <span dangerouslySetInnerHTML={{ __html: parsedLine.replace(/^- /, "") }} />
          </div>
        );
      }
      if (line.startsWith("|")) {
        return null;
      }
      return (
        <p
          key={idx}
          className="text-sm leading-relaxed mb-1.5"
          dangerouslySetInnerHTML={{
            __html: parsedLine || "\u00A0",
          }}
        />
      );
    });
  };

  const groupByTime = (convs) => {
    const today = [];
    const yesterday = [];
    const older = [];
    convs.forEach((c) => {
      if (c.timeCategory === "Today") today.push(c);
      else if (c.timeCategory === "Yesterday") yesterday.push(c);
      else older.push(c);
    });
    const groups = [];
    if (today.length) groups.push({ label: "Today", items: today });
    if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday });
    if (older.length) groups.push({ label: "Older", items: older });
    return groups;
  };

  return (
    <div className="flex h-screen bg-[#faf7f3]">
        {/* Sidebar */}
        <aside className="w-[280px] shrink-0 flex flex-col border-r border-[#eae6e1] bg-white">
          <div className="p-5 border-b border-[#eae6e1] flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <img src="/icon.png" className="w-8 h-8 rounded-lg object-contain" />
              <div className="flex flex-col leading-none">
                <span className="font-bold text-base tracking-tight">Clarix</span>
                <span className="text-[10px] text-zinc-500 font-mono">Learn</span>
              </div>
            </div>
            <button
              onClick={handleNewConversation}
              disabled={!selectedClassroom}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold bg-[#4A7C59] text-white hover:bg-[#faf7f3] hover:text-[#4A7C59] border border-[#4A7C59] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              New Conversation
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {!selectedClassroom ? (
              <div className="text-center py-8 text-xs text-zinc-400">
                Select a classroom to start
              </div>
            ) : loadingSessions ? (
              <div className="text-center py-8 text-xs text-zinc-400">
                Loading...
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-xs text-zinc-400">
                No conversations yet
              </div>
            ) : (
              groupByTime(conversations).map((group) => (
                <div key={group.label}>
                  <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase block px-1 mb-2">
                    {group.label}
                  </span>
                  <div className="space-y-0.5">
                    {group.items.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => handleSelectConv(conv.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs text-left transition-all ${
                          activeConvId === conv.id
                            ? "bg-[#faf7f3] text-[#4A7C59] font-semibold border border-[#eae6e1]"
                            : "text-zinc-700 hover:bg-[#faf7f3] border border-transparent"
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{conv.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main Chat Panel */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="px-6 py-3 border-b border-[#eae6e1] bg-[#faf7f3] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={selectedClassroom?.id || ""}
                    onChange={(e) => handleClassroomChange(e.target.value)}
                    className="pl-3 pr-7 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium appearance-none focus:outline-none cursor-pointer bg-white text-zinc-700"
                  >
                    <option value="" disabled>
                      Select a classroom...
                    </option>
                    {classrooms.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
                </div>

                <button
                  onClick={() => setShowResourceList(!showResourceList)}
                  className={`p-1.5 rounded-lg border flex items-center gap-1.5 text-2xs font-medium transition-colors ${
                    showResourceList
                      ? "bg-[#faf7f3] text-[#4A7C59] border-[#eae6e1]"
                      : "border-zinc-200 text-zinc-500 hover:bg-[#faf7f3]"
                  }`}
                >
                  <Folder className="w-3 h-3" />
                  <span className="hidden sm:inline">
                    Resources ({activeResources.length})
                  </span>
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied!");
              }}
              className="p-1.5 rounded-lg hover:bg-[#faf7f3] text-zinc-400 transition-colors"
              title="Share"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </header>

          {/* Resources Bar */}
          {showResourceList && (
            <div className="px-6 py-3 border-b border-[#eae6e1] bg-[#faf7f3] space-y-2 shrink-0">
              <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase block">
                Classroom Resources
              </span>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {activeResources.length === 0 ? (
                  <p className="text-zinc-400 text-xs">
                    No resources uploaded yet. Upload PDFs in the classroom to enable AI answers.
                  </p>
                ) : (
                  activeResources.map((res) => (
                    <div
                      key={res.id}
                      onClick={() => setSelectedResource(res)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-[#eae6e1] text-2xs cursor-pointer hover:border-[#4A7C59] transition-colors"
                    >
                      <FileText className="w-3 h-3 text-[#4A7C59] shrink-0" />
                      <span className="text-zinc-700">{res.filename || res.title}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#faf7f3]/30">
          {!selectedClassroom ? (
            <div className="h-full flex flex-col justify-center items-center text-center p-6">
              <div className="p-4 rounded-full bg-[#faf7f3] text-[#4A7C59] mb-4">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-semibold text-zinc-900">
                Select a Classroom
              </h4>
              <p className="text-sm text-zinc-500 mt-1 max-w-sm">
                Choose a classroom from the dropdown above to start chatting with AI
              </p>
            </div>
          ) : !activeConvId ? (
            <div className="h-full flex flex-col justify-center items-center text-center p-6">
              <div className="p-4 rounded-full bg-[#faf7f3] text-[#4A7C59] mb-4">
                <Sparkles className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-semibold text-zinc-900">
                Start a Conversation
              </h4>
              <p className="text-sm text-zinc-500 mt-1 max-w-sm">
                Create a new conversation to ask questions about your classroom resources
              </p>
              <button
                onClick={handleNewConversation}
                className="mt-4 px-4 py-2 bg-[#4A7C59] text-white text-sm font-semibold rounded-xl border border-[#4A7C59] hover:bg-[#faf7f3] hover:text-[#4A7C59] transition-colors"
              >
                + New Conversation
              </button>
            </div>
          ) : activeConv?.messages?.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center p-6">
              <div className="p-4 rounded-full bg-[#faf7f3] text-[#4A7C59] mb-4">
                <Sparkles className="w-8 h-8 animate-pulse" />
              </div>
              <h4 className="text-lg font-semibold text-zinc-900">
                Ask anything
              </h4>
              <p className="text-sm text-zinc-500 mt-1 max-w-sm">
                Ask questions about your uploaded resources and the AI will answer based on your classroom materials.
              </p>
            </div>
          ) : (
            activeConv?.messages?.map((msg) => (
              <div
                key={msg.id}
                className={`flex max-w-3xl gap-3 ${
                  msg.role === "user" ? "ml-auto flex-row-reverse" : ""
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    msg.role === "user"
                      ? "bg-[#4A7C59] text-white"
                      : "bg-[#faf7f3] text-[#4A7C59]"
                  }`}
                >
                  {msg.role === "user" ? (
                    "U"
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </div>

                <div
                  className={`flex-1 p-4 rounded-2xl ${
                    msg.role === "user"
                      ? "bg-[#4A7C59] text-white"
                      : "bg-[#faf7f3] text-zinc-700"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  ) : (
                    <div className="prose-sm max-w-none leading-relaxed">
                      {renderMarkdown(msg.content)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {isSubmitting && (
            <div className="flex max-w-3xl gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#faf7f3] text-[#4A7C59] shrink-0">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
              <div className="flex-1 p-4 rounded-2xl bg-[#faf7f3]/50">
                <span className="text-sm text-zinc-400 italic">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <footer className="p-4 border-t border-[#eae6e1] bg-white shrink-0">
          <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto">
            <textarea
              className="w-full min-h-[48px] max-h-32 p-3.5 pb-12 rounded-xl border border-zinc-200 text-sm leading-relaxed focus:outline-none focus:border-[#4A7C59] focus:ring-2 focus:ring-[#4A7C59]/15 pr-14 resize-none bg-white text-zinc-900 placeholder:text-zinc-400 transition-all"
              placeholder="Ask a question about your resources..."
              rows={1}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />

            <div className="absolute left-3.5 bottom-3 flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-md hover:bg-[#faf7f3] text-zinc-400 transition-colors"
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".txt,.pdf,.md"
                onChange={handleFileChange}
              />
            </div>

            <button
              type="submit"
              disabled={!inputMessage.trim() || isSubmitting || !activeConvId}
              className="absolute right-2.5 bottom-2.5 p-2.5 rounded-xl bg-[#4A7C59] text-white hover:bg-[#faf7f3] hover:text-[#4A7C59] border border-[#4A7C59] transition-all active:scale-[0.95] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="text-[10px] text-zinc-400 text-center mt-2">
            AI can make mistakes. Verify important information.
          </p>
        </footer>
      </main>

      {/* Resource Viewer Drawer */}
      {selectedResource && (
        <aside className="w-[450px] shrink-0 flex flex-col border-l border-[#eae6e1] bg-white">
          <header className="px-4 py-3 border-b border-[#eae6e1] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-[#4A7C59] shrink-0" />
              <span className="text-sm font-medium text-zinc-900 truncate">
                {selectedResource.filename || selectedResource.title}
              </span>
            </div>
            <button
              onClick={() => setSelectedResource(null)}
              className="p-1 rounded-md hover:bg-[#faf7f3] text-zinc-400 hover:text-zinc-900 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </header>
          <div className="flex-1 bg-zinc-50">
            <iframe
              src={selectedResource.file_url}
              className="w-full h-full"
              title={selectedResource.filename || "Resource viewer"}
            />
          </div>
        </aside>
      )}
    </div>
  );
};

export default Learn;
