import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import api from "@/lib/api"
import { Send, Bot, User } from "lucide-react"

export default function ChatTab({ classroomId }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! Ask me anything about the classroom resources." },
  ])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!query.trim() || loading) return

    const userMsg = query.trim()
    setQuery("")
    setMessages((prev) => [...prev, { role: "user", content: userMsg }])
    setLoading(true)

    try {
      const res = await api.post(`/classrooms/${classroomId}/chat`, { query: userMsg })
      setMessages((prev) => [...prev, { role: "assistant", content: res.data.response }])
    } catch (err) {
      toast.error("Chat failed. Make sure resources are uploaded and indexed.")
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't get a response. Please try again." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${msg.role === "user" ? "bg-blue-600" : "bg-gray-200"}`}>
              {msg.role === "user" ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-gray-600" />}
            </div>
            <div className={`max-w-[75%] rounded-lg px-4 py-2 text-sm ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="shrink-0 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
              <Bot className="h-4 w-4 text-gray-600" />
            </div>
            <div className="bg-gray-100 rounded-lg px-4 py-2 text-sm text-gray-400 animate-pulse">Thinking...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about the resources..."
          disabled={loading}
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !query.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
