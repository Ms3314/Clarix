import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import Navbar from "@/components/layout/Navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import api from "@/lib/api"
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export default function QuizAttempt() {
  const { id, qid } = useParams()
  const classroomId = Number(id)
  const quizId = Number(qid)
  const navigate = useNavigate()

  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: quiz, isLoading } = useQuery({
    queryKey: ["quiz", classroomId, quizId],
    queryFn: () => api.get(`/classrooms/${classroomId}/quizzes/${quizId}`).then((r) => r.data),
  })

  function selectAnswer(questionIdx, optionIdx) {
    if (result) return
    setAnswers((prev) => ({ ...prev, [questionIdx]: optionIdx }))
  }

  async function handleSubmit() {
    if (!quiz) return
    const answersArray = quiz.questions.map((_, i) => answers[i] ?? -1)
    setSubmitting(true)
    try {
      const res = await api.post(`/classrooms/${classroomId}/quizzes/${quizId}/attempt`, {
        answers: answersArray,
      })
      setResult(res.data)
    } catch (err) {
      toast.error(err.response?.data?.detail || "Submission failed")
    } finally {
      setSubmitting(false)
    }
  }

  const allAnswered = quiz?.questions.every((_, i) => answers[i] !== undefined)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-lg" />)}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(`/classrooms/${classroomId}`)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Classroom
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{quiz?.title}</h1>
          {quiz?.description && <p className="text-gray-500 mt-1">{quiz.description}</p>}
          <p className="text-sm text-gray-400 mt-1">{quiz?.questions?.length} questions</p>
        </div>

        {result && (
          <Card className="mb-6 border-2 border-blue-200 bg-blue-50">
            <CardContent className="pt-6 text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {result.score.toFixed(0)}%
              </div>
              <p className="text-gray-700">
                {result.correct_answers} / {result.total_questions} correct
              </p>
              <Button className="mt-4" onClick={() => navigate(`/classrooms/${classroomId}`)}>
                Back to Classroom
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {quiz?.questions.map((q, qi) => (
            <Card key={q.id} className={cn(result && "opacity-80")}>
              <CardContent className="pt-4">
                <p className="font-medium text-gray-800 mb-3">
                  <span className="text-gray-400 mr-2">Q{qi + 1}.</span>
                  {q.question}
                </p>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => {
                    const selected = answers[qi] === oi
                    const isCorrect = result && q.correct_answer === oi
                    const isWrong = result && selected && !isCorrect
                    return (
                      <button
                        key={oi}
                        onClick={() => selectAnswer(qi, oi)}
                        disabled={!!result}
                        className={cn(
                          "w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors",
                          selected && !result && "border-blue-500 bg-blue-50 text-blue-800",
                          !selected && !result && "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                          isCorrect && "border-green-500 bg-green-50 text-green-800",
                          isWrong && "border-red-400 bg-red-50 text-red-800",
                          !selected && result && !isCorrect && "border-gray-200 text-gray-400"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {result && isCorrect && <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
                          {result && isWrong && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                          {opt}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {!result && (
          <div className="mt-6">
            <Button
              onClick={handleSubmit}
              disabled={submitting || !allAnswered}
              className="w-full"
            >
              {submitting ? "Submitting..." : !allAnswered ? "Answer all questions to submit" : "Submit Quiz"}
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
