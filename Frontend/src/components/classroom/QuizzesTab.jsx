import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import api from "@/lib/api"
import { Plus, Trash2, BookOpen, Play } from "lucide-react"

function CreateQuizDialog({ classroomId, onClose }) {
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [questions, setQuestions] = useState([{ question: "", options: ["", "", "", ""], correct_answer: 0 }])
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  function addQuestion() {
    setQuestions([...questions, { question: "", options: ["", "", "", ""], correct_answer: 0 }])
  }

  function removeQuestion(i) {
    setQuestions(questions.filter((_, idx) => idx !== i))
  }

  function updateQuestion(i, field, value) {
    const q = [...questions]
    q[i] = { ...q[i], [field]: value }
    setQuestions(q)
  }

  function updateOption(qi, oi, value) {
    const q = [...questions]
    const opts = [...q[qi].options]
    opts[oi] = value
    q[qi] = { ...q[qi], options: opts }
    setQuestions(q)
  }

  async function handleCreate() {
    setLoading(true)
    try {
      await api.post(`/classrooms/${classroomId}/quizzes`, {
        title,
        description,
        questions: questions.map((q, i) => ({ ...q, order: i })),
      })
      toast.success("Quiz created!")
      queryClient.invalidateQueries(["quizzes", classroomId])
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create quiz")
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Create Quiz — Step {step} of 2</DialogTitle>
      </DialogHeader>

      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Quiz Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chapter 3 Review" />
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." rows={2} />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div key={qi} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Q{qi + 1}</span>
                {questions.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeQuestion(qi)} className="text-gray-400 hover:text-red-500 h-7 w-7">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <Input value={q.question} onChange={(e) => updateQuestion(qi, "question", e.target.value)} placeholder="Enter question..." />
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={q.correct_answer === oi}
                      onChange={() => updateQuestion(qi, "correct_answer", oi)}
                      className="accent-blue-600"
                    />
                    <Input value={opt} onChange={(e) => updateOption(qi, oi, e.target.value)} placeholder={`Option ${oi + 1}`} className="text-sm h-8" />
                  </div>
                ))}
                <p className="text-xs text-gray-400">Select the radio button next to the correct answer</p>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={addQuestion} className="w-full">
            <Plus className="h-4 w-4" /> Add Question
          </Button>
        </div>
      )}

      <DialogFooter>
        {step === 2 && <Button variant="outline" onClick={() => setStep(1)}>Back</Button>}
        {step === 1 && (
          <>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => setStep(2)} disabled={!title.trim()}>Next</Button>
          </>
        )}
        {step === 2 && (
          <Button onClick={handleCreate} disabled={loading || questions.some((q) => !q.question.trim())}>
            {loading ? "Creating..." : "Create Quiz"}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  )
}

export default function QuizzesTab({ classroomId }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["quizzes", classroomId],
    queryFn: () => api.get(`/classrooms/${classroomId}/quizzes`).then((r) => r.data.quizzes),
  })

  if (isLoading) return <div className="h-40 bg-gray-100 animate-pulse rounded-lg" />

  return (
    <div className="space-y-4">
      {user?.role === "teacher" && (
        <div className="flex justify-end">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> Create Quiz</Button>
            </DialogTrigger>
            <CreateQuizDialog classroomId={classroomId} onClose={() => setCreateOpen(false)} />
          </Dialog>
        </div>
      )}

      {data?.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No quizzes yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((quiz) => (
            <div key={quiz.id} className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 bg-white">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{quiz.title}</p>
                {quiz.description && <p className="text-xs text-gray-400 truncate">{quiz.description}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">{quiz.question_count} questions</span>
                  {quiz.is_ai_generated && <Badge variant="secondary" className="text-xs">AI Generated</Badge>}
                </div>
              </div>
              {user?.role === "student" && (
                <Button size="sm" onClick={() => navigate(`/classrooms/${classroomId}/quizzes/${quiz.id}/attempt`)}>
                  <Play className="h-3.5 w-3.5" /> Take Quiz
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
