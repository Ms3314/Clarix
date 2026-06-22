import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles, MessageSquare, Plus, Folder, Share2, Paperclip, Send, FileText,
  ChevronDown, ArrowLeft, X, PanelLeftClose, PanelLeft
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import useClassroomStore from "@/stores/classroomStore";
import useLearnStore from "@/stores/learnStore";

const Learn = () => {
  const navigate = useNavigate();
  const classrooms = useClassroomStore((s) => s.classrooms);
  const fetchClassrooms = useClassroomStore((s) => s.fetchClassrooms);
  const {
    sessions, activeSessionId, messagesBySession, isLoading: sessionsLoading,
    fetchSessions, fetchMessages, setActiveSession,
    createSession, addMessage, updateSessionTitle,
  } = useLearnStore();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [resources, setResources] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResourceList, setShowResourceList] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  const activeConv = sessions.find((c) => c.id === activeSessionId);
  const activeMessages = activeSessionId ? (messagesBySession[activeSessionId] || []) : [];

  useEffect(() => {
    fetchClassrooms();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, isSubmitting]);

  useEffect(() => {
    if (!inputMessage && textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [inputMessage]);

  useEffect(() => {
    if (classrooms.length > 0 && !selectedClassroom) {
      setSelectedClassroom(classrooms[0]);
    }
  }, [classrooms]);

  useEffect(() => {
    if (selectedClassroom) {
      fetchSessions(selectedClassroom.id);
      fetchResourcesForClassroom(selectedClassroom.id);
      setActiveSession(null);
    }
  }, [selectedClassroom]);

  const fetchResourcesForClassroom = async (classroomId) => {
    try {
      const res = await api.get(`/classrooms/${classroomId}/resources`);
      setResources(res.data.resources || []);
    } catch {
      // silent
    }
  };

  const handleSelectConv = (id) => {
    setActiveSession(id);
    const conv = sessions.find((c) => c.id === id);
    const msgs = messagesBySession[id] || [];
    if (conv && msgs.length === 0 && selectedClassroom) {
      fetchMessages(id, selectedClassroom.id);
    }
  };

  const handleNewConversation = async () => {
    if (!selectedClassroom) return;
    await createSession(selectedClassroom.id);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSubmitting || !selectedClassroom || !activeSessionId) return;

    const userText = inputMessage;
    setInputMessage("");

    const userMsg = {
      id: "msg-user-" + Date.now(),
      role: "user",
      content: userText,
      timestamp: new Date().toLocaleTimeString(),
    };

    const prevMessages = activeMessages;
    addMessage(activeSessionId, userMsg);

    if (prevMessages.length === 0) {
      const title = userText.length > 25 ? userText.slice(0, 25) + "..." : userText;
      updateSessionTitle(activeSessionId, title);
    }

    setIsSubmitting(true);

    try {
      const res = await api.post(
        `/classrooms/${selectedClassroom.id}/chat/sessions/${activeSessionId}/messages`,
        { query: userText }
      );

      const aiMsg = {
        id: "msg-ai-" + Date.now(),
        role: "assistant",
        content: res.data.response,
        timestamp: new Date().toLocaleTimeString(),
      };

      addMessage(activeSessionId, aiMsg);
      if (res.data.session?.title) {
        updateSessionTitle(activeSessionId, res.data.session.title);
      }
    } catch (err) {
      const errorMsg = {
        id: "msg-err-" + Date.now(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toLocaleTimeString(),
      };
      addMessage(activeSessionId, errorMsg);
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

  const markdownComponents = {
    h1: ({ children }) => <h1 className="text-2xl font-bold mt-5 mb-2 text-zinc-900 leading-tight">{children}</h1>,
    h2: ({ children }) => <h2 className="text-xl font-bold mt-4 mb-2 text-zinc-900 leading-tight">{children}</h2>,
    h3: ({ children }) => <h3 className="text-lg font-bold mt-3 mb-1 text-zinc-800 leading-snug">{children}</h3>,
    h4: ({ children }) => <h4 className="text-base font-semibold mt-2 mb-1 text-zinc-800">{children}</h4>,
    p: ({ children }) => <p className="text-[15px] leading-relaxed mb-2">{children}</p>,
    ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
    li: ({ children }) => <li className="text-[15px] leading-relaxed">{children}</li>,
    code: ({ children }) => <code className="bg-zinc-200/60 px-1.5 py-0.5 rounded text-[13px] font-mono text-zinc-800">{children}</code>,
    pre: ({ children }) => <pre className="bg-zinc-200/40 p-3 rounded-lg overflow-x-auto mb-3 text-[13px] font-mono">{children}</pre>,
    strong: ({ children }) => <strong className="font-bold text-zinc-900">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-3 border-[#4A7C59] pl-3 py-1 my-2 text-zinc-600 text-[15px] italic bg-[#4A7C59]/5 rounded-r-lg">{children}</blockquote>
    ),
    hr: () => <hr className="my-4 border-zinc-200" />,
    a: ({ children, href }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#4A7C59] underline hover:text-[#3d6549]">{children}</a>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-4 border border-zinc-200 rounded-lg">
        <table className="w-full text-[13px] border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-zinc-100 border-b border-zinc-200">{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr className="border-b border-zinc-100 last:border-0 even:bg-zinc-50">{children}</tr>,
    th: ({ children }) => <th className="px-3 py-2.5 text-left text-[13px] font-bold uppercase tracking-wider text-zinc-600">{children}</th>,
    td: ({ children }) => <td className="px-3 py-2.5 text-[15px] text-zinc-700">{children}</td>,
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
    <div className="flex h-screen bg-[#faf7f3] relative">
        {/* Sidebar */}
        <aside
          className={`shrink-0 flex flex-col border-r border-[#eae6e1] bg-white transition-all duration-300 ease-in-out overflow-hidden ${
            sidebarOpen ? "w-[240px]" : "w-0 border-r-0"
          }`}
        >
          <div className="p-3 border-b border-[#eae6e1] flex flex-col gap-3 min-w-[240px]">
            <div className="flex items-center gap-2">
              <img src="/icon.png" className="w-7 h-7 rounded-lg object-contain" />
              <div className="flex flex-col leading-none">
                <span className="font-bold text-sm tracking-tight">Clarix</span>
                <span className="text-[10px] text-zinc-500">Learn</span>
              </div>
            </div>
            <button
              onClick={handleNewConversation}
              disabled={!selectedClassroom}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold bg-[#4A7C59] text-white hover:bg-[#faf7f3] hover:text-[#4A7C59] border border-[#4A7C59] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              New Conversation
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4 min-w-[240px]">
            {!selectedClassroom ? (
              <div className="text-center py-6 text-xs text-zinc-400">
                Select a classroom to start
              </div>
            ) : sessionsLoading ? (
              <div className="text-center py-6 text-xs text-zinc-400">
                Loading...
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-6 text-xs text-zinc-400">
                No conversations yet
              </div>
            ) : (
              groupByTime(sessions).map((group) => (
                <div key={group.label}>
                  <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase block px-1 mb-1">
                    {group.label}
                  </span>
                  <div className="space-y-0.5">
                    {group.items.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => handleSelectConv(conv.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-left transition-all ${
                          activeSessionId === conv.id
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
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-[#eae6e1] transition-all text-zinc-400 hover:text-zinc-700 cursor-pointer"
                title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
              </button>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={selectedClassroom?.id || ""}
                    onChange={(e) => handleClassroomChange(e.target.value)}
                    className="pl-3 pr-7 py-2 rounded-lg border border-zinc-200 text-sm font-medium appearance-none focus:outline-none cursor-pointer bg-white text-zinc-700"
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
                  <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
                </div>

                <button
                  onClick={() => setShowResourceList(!showResourceList)}
                  className={`p-1.5 rounded-lg border flex items-center gap-1.5 text-xs font-medium transition-colors ${
                    showResourceList
                      ? "bg-[#faf7f3] text-[#4A7C59] border-[#eae6e1]"
                      : "border-zinc-200 text-zinc-500 hover:bg-[#faf7f3]"
                  }`}
                >
                  <Folder className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    Resources ({activeResources.length})
                  </span>
                </button>
              </div>
            </div>

          </header>

          {/* Resources Bar */}
          {showResourceList && (
            <div className="px-6 py-3 border-b border-[#eae6e1] bg-[#faf7f3] space-y-2 shrink-0">
              <span className="text-xs font-bold tracking-wider text-zinc-400 uppercase block">
                Classroom Resources
              </span>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {activeResources.length === 0 ? (
                  <p className="text-zinc-400 text-sm">
                    No resources uploaded yet. Upload PDFs in the classroom to enable AI answers.
                  </p>
                ) : (
                  activeResources.map((res) => (
                    <div
                      key={res.id}
                      onClick={() => setSelectedResource(res)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white border border-[#eae6e1] text-xs cursor-pointer hover:border-[#4A7C59] transition-colors"
                    >
                      <FileText className="w-4 h-4 text-[#4A7C59] shrink-0" />
                      <span className="text-zinc-700">{res.filename || res.title}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto pt-10 px-6 pb-36 space-y-4 relative bg-[#faf7f3]/30">
          {!selectedClassroom ? (
            <div className="h-full flex flex-col justify-center items-center text-center p-6">
              <div className="p-4 rounded-full bg-[#faf7f3] text-[#4A7C59] mb-4">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-semibold text-zinc-900">
                Select a Classroom
              </h4>
              <p className="text-base text-zinc-500 mt-1 max-w-sm">
                Choose a classroom from the dropdown above to start chatting with AI
              </p>
            </div>
          ) : !activeSessionId ? (
            <div className="h-full flex flex-col justify-center items-center text-center p-6">
              <div className="p-4 rounded-full bg-[#faf7f3] text-[#4A7C59] mb-4">
                <Sparkles className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-semibold text-zinc-900">
                Start a Conversation
              </h4>
              <p className="text-base text-zinc-500 mt-1 max-w-sm">
                Create a new conversation to ask questions about your classroom resources
              </p>
              <button
                onClick={handleNewConversation}
                className="mt-4 px-3 py-1.5 bg-[#4A7C59] text-white text-sm font-semibold rounded-xl border border-[#4A7C59] hover:bg-[#faf7f3] hover:text-[#4A7C59] transition-colors"
              >
                + New Conversation
              </button>
            </div>
          ) : activeMessages.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center p-6">
              <div className="p-4 rounded-full bg-[#faf7f3] text-[#4A7C59] mb-4">
                <Sparkles className="w-8 h-8 animate-pulse" />
              </div>
              <h4 className="text-lg font-semibold text-zinc-900">
                Ask anything
              </h4>
              <p className="text-base text-zinc-500 mt-1 max-w-sm">
                Ask questions about your uploaded resources and the AI will answer based on your classroom materials.
              </p>
            </div>
          ) : (
            activeMessages.map((msg) => (
  <div
    key={msg.id}
    className="w-full max-w-4xl mx-auto"
  >
    <div
      className={`flex ${
        msg.role === "user"
          ? "justify-end"
          : "justify-start"
      }`}
    >
      <div
        className={`rounded-3xl px-5 py-3 ${
          msg.role === "user"
            ? "max-w-[70%] bg-[#4A7C59] text-white"
            : "w-full text-zinc-800"
        }`}
      >
        {msg.role === "user" ? (
          <p className="text-[15px] leading-relaxed">
            {msg.content}
          </p>
        ) : (
          <div className="leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  </div>
))
          )}

          {isSubmitting && (
            <div className="flex max-w-2xl">
              <div className="flex-1 p-3 rounded-2xl bg-[#faf7f3]/50">
                <span className="text-[15px] text-zinc-400">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Floating Input */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#faf7f3] via-[#faf7f3]/95 to-transparent pt-12 pb-4 px-4 pointer-events-none">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 max-w-4xl mx-auto pointer-events-auto">
            <textarea
              ref={textareaRef}
              className="flex-1 min-h-[44px] max-h-[200px] p-3 rounded-xl border border-zinc-200 text-base leading-relaxed focus:outline-none focus:border-[#4A7C59] focus:ring-2 focus:ring-[#4A7C59]/15 resize-none bg-white text-zinc-900 placeholder:text-zinc-400 overflow-y-auto shadow-lg shadow-black/5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-zinc-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
              placeholder="Ask a question about your resources..."
              rows={1}
              value={inputMessage}
              onChange={(e) => {
                setInputMessage(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            /> 
            <button
              type="submit"
              disabled={!inputMessage.trim() || isSubmitting || !activeSessionId}
              className="shrink-0 p-2.5 rounded-xl bg-[#4A7C59] text-white hover:bg-[#faf7f3] hover:text-[#4A7C59] border border-[#4A7C59] transition-all active:scale-[0.95] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="text-[10px] text-zinc-400 text-center mt-2 pointer-events-auto">
            AI can make mistakes. Verify important information.
          </p>
        </div>
      </main>

      {/* Resource Viewer Drawer */}
      {selectedResource && (
        <aside className="absolute top-0 right-0 h-full w-[450px] flex flex-col border-l border-[#eae6e1] bg-white shadow-xl z-20">
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
