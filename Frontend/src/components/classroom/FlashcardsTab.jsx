import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import api from "@/lib/api"
import { Plus, Trash2, Edit, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react"

function FlashcardViewer({ cards }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  if (!cards.length) return null

  const card = cards[index]

  return (
    <div className="space-y-4">
      <div className="text-center text-sm text-gray-400">{index + 1} / {cards.length}</div>
      <div
        className="relative h-48 cursor-pointer select-none"
        onClick={() => setFlipped((f) => !f)}
        style={{ perspective: "1000px" }}
      >
        <div
          className="absolute inset-0 transition-transform duration-500 rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-6 text-center"
          style={{ backfaceVisibility: "hidden", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          <p className="text-lg font-medium text-gray-800">{card.front}</p>
        </div>
        <div
          className="absolute inset-0 transition-transform duration-500 rounded-xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-6 text-center"
          style={{ backfaceVisibility: "hidden", transform: flipped ? "rotateY(0deg)" : "rotateY(-180deg)" }}
        >
          <p className="text-lg text-gray-700">{card.back}</p>
        </div>
      </div>
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" onClick={() => { setIndex((i) => Math.max(0, i - 1)); setFlipped(false) }} disabled={index === 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setFlipped(false)} title="Reset">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => { setIndex((i) => Math.min(cards.length - 1, i + 1)); setFlipped(false) }} disabled={index === cards.length - 1}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function FlashcardFormDialog({ classroomId, existing, onClose }) {
  const [front, setFront] = useState(existing?.front ?? "")
  const [back, setBack] = useState(existing?.back ?? "")
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  async function handleSave() {
    if (!front.trim() || !back.trim()) return
    setLoading(true)
    try {
      if (existing) {
        await api.put(`/classrooms/${classroomId}/flashcards/${existing.id}`, { front, back })
        toast.success("Flashcard updated")
      } else {
        await api.post(`/classrooms/${classroomId}/flashcards`, { front, back })
        toast.success("Flashcard created")
      }
      queryClient.invalidateQueries(["flashcards", classroomId])
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save flashcard")
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{existing ? "Edit Flashcard" : "New Flashcard"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Front (question)</Label>
          <Textarea value={front} onChange={(e) => setFront(e.target.value)} placeholder="Question or term..." rows={3} />
        </div>
        <div className="space-y-2">
          <Label>Back (answer)</Label>
          <Textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder="Answer or definition..." rows={3} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={loading || !front.trim() || !back.trim()}>
          {loading ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

export default function FlashcardsTab({ classroomId }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ["flashcards", classroomId],
    queryFn: () => api.get(`/classrooms/${classroomId}/flashcards`).then((r) => r.data.flashcards),
  })

  async function handleDelete(id) {
    try {
      await api.delete(`/classrooms/${classroomId}/flashcards/${id}`)
      toast.success("Flashcard deleted")
      queryClient.invalidateQueries(["flashcards", classroomId])
    } catch {
      toast.error("Delete failed")
    }
  }

  if (isLoading) return <div className="h-40 bg-gray-100 animate-pulse rounded-lg" />

  return (
    <div className="space-y-6">
      {data?.length > 0 && <FlashcardViewer cards={data} />}

      {user?.role === "teacher" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Manage Flashcards ({data?.length ?? 0})</h3>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4" /> Add Card</Button>
              </DialogTrigger>
              <FlashcardFormDialog classroomId={classroomId} onClose={() => setCreateOpen(false)} />
            </Dialog>
          </div>

          {data?.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No flashcards yet</p>
          ) : (
            <div className="space-y-2">
              {data.map((f) => (
                <div key={f.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{f.front}</p>
                    <p className="text-xs text-gray-400 truncate">{f.back}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Dialog open={editing?.id === f.id} onOpenChange={(o) => !o && setEditing(null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setEditing(f)} className="text-gray-400 hover:text-blue-500">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      {editing?.id === f.id && (
                        <FlashcardFormDialog classroomId={classroomId} existing={editing} onClose={() => setEditing(null)} />
                      )}
                    </Dialog>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {user?.role === "student" && data?.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No flashcards available yet</p>
      )}
    </div>
  )
}
