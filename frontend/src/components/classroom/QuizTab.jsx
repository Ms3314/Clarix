import { useState } from 'react'
import {
  Plus, Trash2, Eye, Edit3, Sparkles, ArrowLeft, HelpCircle, Loader2,
  Trophy,
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'
import useClassroomDetailStore from '@/stores/classroomDetailStore'

const emptyQuestion = (order = 0) => ({
  question: '',
  options: ['', '', '', ''],
  correct_answer: 0,
  order,
})

export default function QuizTab({ classroomId, isTeacher }) {
  const { getEntityData, invalidateEntity, fetchQuizzes } = useClassroomDetailStore()
  const quizzes = getEntityData(classroomId, 'quizzes') || []

  const [mode, setMode] = useState('list')
  const [selectedQuizId, setSelectedQuizId] = useState(null)
  const [quizDetail, setQuizDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formQuestions, setFormQuestions] = useState([emptyQuestion(0)])
  const [saving, setSaving] = useState(false)

  const [aiTopic, setAiTopic] = useState('')
  const [aiDifficulty, setAiDifficulty] = useState('medium')
  const [aiNumQuestions, setAiNumQuestions] = useState(5)
  const [generatingAI, setGeneratingAI] = useState(false)

  const [deletingId, setDeletingId] = useState(null)

  const [attemptAnswers, setAttemptAnswers] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [attemptResult, setAttemptResult] = useState(null)

  const [attempts, setAttempts] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [loadingScores, setLoadingScores] = useState(false)

  const refreshQuizzes = () => {
    invalidateEntity(classroomId, 'quizzes')
    fetchQuizzes(classroomId, true)
  }

  const resetForm = () => {
    setFormTitle('')
    setFormDescription('')
    setFormQuestions([emptyQuestion(0)])
    setAiTopic('')
    setAiDifficulty('medium')
    setAiNumQuestions(5)
  }

  const addQuestion = () => {
    setFormQuestions([...formQuestions, emptyQuestion(formQuestions.length)])
  }

  const removeQuestion = (index) => {
    if (formQuestions.length <= 1) return
    setFormQuestions(formQuestions.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i })))
  }

  const updateQuestion = (index, value) => {
    const updated = [...formQuestions]
    updated[index] = { ...updated[index], question: value }
    setFormQuestions(updated)
  }

  const updateOption = (qIndex, oIndex, value) => {
    const updated = [...formQuestions]
    updated[qIndex].options[oIndex] = value
    setFormQuestions(updated)
  }

  const setCorrectAnswer = (qIndex, value) => {
    const updated = [...formQuestions]
    updated[qIndex].correct_answer = value
    setFormQuestions(updated)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!formTitle.trim()) {
      toast.error('Please enter a quiz title')
      return
    }
    const validQuestions = formQuestions.filter((q) => q.question.trim())
    if (validQuestions.length === 0) {
      toast.error('Please add at least one question')
      return
    }
    setSaving(true)
    try {
      await api.post(`/classrooms/${classroomId}/quizzes`, {
        title: formTitle,
        description: formDescription || `${validQuestions.length} questions`,
        questions: validQuestions.map((q) => ({
          question: q.question,
          options: q.options,
          correct_answer: q.correct_answer,
          order: q.order,
        })),
        is_ai_generated: false,
      })
      toast.success('Quiz created!')
      refreshQuizzes()
      setMode('list')
      resetForm()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create quiz')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!formTitle.trim()) {
      toast.error('Please enter a quiz title')
      return
    }
    const validQuestions = formQuestions.filter((q) => q.question.trim())
    if (validQuestions.length === 0) {
      toast.error('Please add at least one question')
      return
    }
    setSaving(true)
    try {
      await api.put(`/classrooms/${classroomId}/quizzes/${selectedQuizId}`, {
        title: formTitle,
        description: formDescription,
        questions: validQuestions.map((q) => ({
          question: q.question,
          options: q.options,
          correct_answer: q.correct_answer,
          order: q.order,
        })),
      })
      toast.success('Quiz updated!')
      refreshQuizzes()
      setMode('list')
      setSelectedQuizId(null)
      resetForm()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update quiz')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (quizId) => {
    if (!window.confirm('Are you sure you want to delete this quiz?')) return
    setDeletingId(quizId)
    try {
      await api.delete(`/classrooms/${classroomId}/quizzes/${quizId}`)
      toast.success('Quiz deleted')
      refreshQuizzes()
    } catch {
      toast.error('Failed to delete quiz')
    } finally {
      setDeletingId(null)
    }
  }

  const handleViewDetail = async (quizId) => {
    setLoadingDetail(true)
    setSelectedQuizId(quizId)
    try {
      const res = await api.get(`/classrooms/${classroomId}/quizzes/${quizId}`)
      setQuizDetail(res.data)
      setAttemptAnswers(new Array(res.data.questions?.length || 0).fill(-1))
      setAttemptResult(null)
      setMode('detail')
    } catch {
      toast.error('Failed to load quiz details')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleEdit = async (quizId) => {
    setLoadingDetail(true)
    setSelectedQuizId(quizId)
    try {
      const res = await api.get(`/classrooms/${classroomId}/quizzes/${quizId}`)
      const data = res.data
      setFormTitle(data.title)
      setFormDescription(data.description || '')
      setFormQuestions(
        data.questions.map((q) => ({
          question: q.question,
          options: q.options,
          correct_answer: q.correct_answer,
          order: q.order,
        }))
      )
      setMode('edit')
    } catch {
      toast.error('Failed to load quiz for editing')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleGenerateAI = async () => {
    if (!aiTopic.trim()) {
      toast.error('Please enter a topic')
      return
    }
    setGeneratingAI(true)
    try {
      await api.post(`/classrooms/${classroomId}/quizzes/generate`, {
        title: `Quiz: ${aiTopic}`,
        topic: aiTopic,
        difficulty: aiDifficulty,
        num_questions: aiNumQuestions,
      })
      toast.success('AI Quiz created!')
      refreshQuizzes()
      setAiTopic('')
      setAiDifficulty('medium')
      setAiNumQuestions(5)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate quiz')
    } finally {
      setGeneratingAI(false)
    }
  }

  const handleSubmitAttempt = async () => {
    const unanswered = attemptAnswers.some((a) => a === -1)
    if (unanswered) {
      toast.error('Please answer all questions before submitting')
      return
    }
    setSubmitting(true)
    try {
      const res = await api.post(`/classrooms/${classroomId}/quizzes/${selectedQuizId}/attempt`, {
        answers: attemptAnswers,
      })
      setAttemptResult(res.data)
      toast.success('Quiz submitted!')
    } catch (err) {
      if (err.response?.status === 400) {
        toast.error('You have already attempted this quiz')
      } else {
        toast.error('Failed to submit quiz')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewScores = async () => {
    setLoadingScores(true)
    try {
      const res = await api.get(`/classrooms/${classroomId}/quizzes/${selectedQuizId}/attempts`)
      setAttempts(res.data.attempts || [])
      setMode('scores')
    } catch {
      toast.error('Failed to load scores')
    } finally {
      setLoadingScores(false)
    }
  }

  const handleViewLeaderboard = async () => {
    setLoadingScores(true)
    try {
      const res = await api.get(`/classrooms/${classroomId}/quizzes/${selectedQuizId}/leaderboard`)
      setLeaderboard(res.data.leaderboard || [])
      setMode('leaderboard')
    } catch {
      toast.error('Failed to load leaderboard')
    } finally {
      setLoadingScores(false)
    }
  }

  const startCreate = () => {
    resetForm()
    setMode('create')
  }

  const goToList = () => {
    setMode('list')
    setSelectedQuizId(null)
    setQuizDetail(null)
    setAttemptResult(null)
    resetForm()
  }

  if (mode === 'result' && attemptResult) {
    const passed = attemptResult.score >= 40
    return (
      <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
        <button
          onClick={goToList}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Quizzes
        </button>

        <div className={`border rounded-xl p-8 text-center bg-white border-[#eae7e4] ${passed ? 'ring-2 ring-emerald-200' : 'ring-2 ring-red-200'}`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${passed ? 'bg-emerald-100' : 'bg-red-100'}`}>
            <Trophy className={`w-8 h-8 ${passed ? 'text-emerald-600' : 'text-red-500'}`} />
          </div>
          <h2 className="text-2xl font-serif font-bold text-zinc-900 mb-2">
            {passed ? 'Great Job!' : 'Keep Practicing!'}
          </h2>
          <div className="text-5xl font-bold font-serif mb-2">
            <span className={passed ? 'text-emerald-600' : 'text-red-500'}>{Math.round(attemptResult.score)}%</span>
          </div>
          <p className="text-sm text-zinc-500 mb-6">
            You got {attemptResult.correct_answers} out of {attemptResult.total_questions} correct
          </p>
          <div className="w-full bg-zinc-100 rounded-full h-3 max-w-xs mx-auto overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${passed ? 'bg-emerald-500' : 'bg-red-400'}`}
              style={{ width: `${attemptResult.score}%` }}
            />
          </div>
          <button
            onClick={goToList}
            className="mt-6 px-6 py-2 text-xs font-semibold rounded-lg text-white bg-[#4a7c59] hover:bg-[#35583f] cursor-pointer transition-colors"
          >
            View All Quizzes
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'scores') {
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <button
          onClick={() => { setMode('detail'); setAttempts([]) }}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Quiz
        </button>

        <div className="border rounded-xl overflow-hidden border-[#eae7e4]">
          <div className="px-5 py-4 bg-white border-b border-[#eae7e4]">
            <h3 className="text-sm font-bold font-sans tracking-tight text-zinc-900">Student Scores</h3>
          </div>
          {attempts.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-400">No attempts yet.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-2xs text-zinc-400 uppercase border-b bg-zinc-50 border-[#eae7e4]">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Correct</th>
                  <th className="py-3 px-4">Attempted</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-zinc-100">
                {attempts.map((a) => (
                  <tr key={a.id} className="text-zinc-800">
                    <td className="py-3 px-4 font-semibold">{a.student_name}</td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${a.score >= 40 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {Math.round(a.score)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-500">
                      {Math.round((a.score / 100) * a.total_questions)}/{a.total_questions}
                    </td>
                    <td className="py-3 px-4 text-zinc-400">{a.attempted_at ? new Date(a.attempted_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  if (mode === 'leaderboard') {
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <button
          onClick={() => { setMode('detail'); setLeaderboard([]) }}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Quiz
        </button>

        <div className="border rounded-xl overflow-hidden border-[#eae7e4]">
          <div className="px-5 py-4 bg-white border-b border-[#eae7e4] flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold font-sans tracking-tight text-zinc-900">Leaderboard</h3>
          </div>
          {leaderboard.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-400">No attempts yet.</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {leaderboard.map((entry) => (
                <div key={entry.rank} className="px-5 py-4 flex items-center gap-4 bg-white">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    entry.rank === 1 ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300' :
                    entry.rank === 2 ? 'bg-zinc-100 text-zinc-600 ring-2 ring-zinc-300' :
                    entry.rank === 3 ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-300' :
                    'bg-zinc-50 text-zinc-400'
                  }`}>
                    {entry.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{entry.student_name}</p>
                    <p className="text-2xs text-zinc-400">{entry.attempted_at ? new Date(entry.attempted_at).toLocaleDateString() : ''}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-bold font-serif ${entry.score >= 40 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {Math.round(entry.score)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (mode === 'detail' && quizDetail) {
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <button
          onClick={goToList}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Quizzes
        </button>

        <div className="border rounded-xl p-6 bg-white border-[#eae7e4]">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-serif font-semibold text-zinc-900">{quizDetail.title}</h2>
              {quizDetail.description && (
                <p className="text-sm text-zinc-500 mt-1">{quizDetail.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-2xs text-zinc-400">
                <span>{quizDetail.questions?.length || 0} Questions</span>
                <span>•</span>
                <span>{quizDetail.created_at ? new Date(quizDetail.created_at).toLocaleDateString() : ''}</span>
              </div>
            </div>
            {isTeacher && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleViewLeaderboard}
                  disabled={loadingScores}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  Leaderboard
                </button>
                <button
                  onClick={handleViewScores}
                  disabled={loadingScores}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#eae7e4] text-zinc-600 hover:bg-zinc-50 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Scores
                </button>
                <button
                  onClick={() => handleEdit(quizDetail.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#eae7e4] text-zinc-600 hover:bg-zinc-50 cursor-pointer transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
              </div>
            )}
          </div>

          {attemptResult ? (
            <div className="mb-6 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
              <p className="text-sm font-bold text-emerald-700">Score: {Math.round(attemptResult.score)}%</p>
              <p className="text-xs text-emerald-600">{attemptResult.correct_answers}/{attemptResult.total_questions} correct</p>
            </div>
          ) : null}

          <div className="space-y-4 mt-6">
            {quizDetail.questions.map((q, qi) => (
              <div key={q.id || qi} className="border rounded-lg p-4 bg-[#fdfaf7] border-[#eae7e4]">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-zinc-400 mt-0.5 min-w-[20px]">{qi + 1}.</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-900 mb-3">{q.question}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, oi) => {
                        const isSelected = attemptAnswers[qi] === oi
                        const isCorrect = q.correct_answer === oi

                        let optionClass = 'border-zinc-200 bg-white text-zinc-600'
                        let badgeClass = 'bg-zinc-200 text-zinc-500'
                        let showCheck = false

                        if (isTeacher) {
                          if (isCorrect) {
                            optionClass = 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            badgeClass = 'bg-emerald-500 text-white'
                            showCheck = true
                          }
                        } else if (attemptResult) {
                          if (isCorrect) {
                            optionClass = 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            badgeClass = 'bg-emerald-500 text-white'
                            showCheck = true
                          } else if (isSelected && !isCorrect) {
                            optionClass = 'border-red-300 bg-red-50 text-red-800'
                            badgeClass = 'bg-red-500 text-white'
                          }
                        } else if (isSelected) {
                          optionClass = 'border-[#4a7c59] bg-green-50 text-zinc-900'
                          badgeClass = 'bg-[#4a7c59] text-white'
                        }

                        return (
                          <div key={oi} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border cursor-pointer transition-colors ${optionClass} ${!isTeacher && !attemptResult ? 'hover:border-zinc-400' : ''}`}
                            onClick={() => {
                              if (!isTeacher && !attemptResult) {
                                const updated = [...attemptAnswers]
                                updated[qi] = oi
                                setAttemptAnswers(updated)
                              }
                            }}
                          >
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${badgeClass}`}>
                              {String.fromCharCode(65 + oi)}
                            </span>
                            <span>{opt}</span>
                            {showCheck && isCorrect && (
                              <span className="ml-auto text-[10px] font-bold text-emerald-600">✓ Correct</span>
                            )}
                            {attemptResult && isSelected && !isCorrect && (
                              <span className="ml-auto text-[10px] font-bold text-red-500">✗</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!isTeacher && !attemptResult && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSubmitAttempt}
                disabled={submitting || attemptAnswers.some((a) => a === -1)}
                className="px-6 py-2.5 text-xs font-semibold rounded-lg text-white bg-[#4a7c59] hover:bg-[#35583f] disabled:bg-zinc-200 cursor-pointer transition-colors flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? 'Submitting...' : 'Submit Attempt'}
              </button>
            </div>
          )}

          {!isTeacher && attemptResult && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setMode('result')}
                className="px-6 py-2.5 text-xs font-semibold rounded-lg text-white bg-[#4a7c59] hover:bg-[#35583f] cursor-pointer transition-colors"
              >
                View Results
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (mode === 'create' || mode === 'edit') {
    const isEdit = mode === 'edit'
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <button
          onClick={goToList}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Quizzes
        </button>

        <form onSubmit={isEdit ? handleUpdate : handleCreate} className="space-y-6">
          <div className="border rounded-xl p-5 space-y-4 bg-white border-[#eae7e4]">
            <h3 className="text-sm font-bold font-sans tracking-tight text-zinc-900">
              {isEdit ? 'Edit Quiz' : 'Create Quiz'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-2xs text-zinc-400 block uppercase tracking-wider font-bold">Title</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none bg-[#fdfaf7] border-[#d4d2d0] text-zinc-800 focus:border-[#4a7c59]"
                  placeholder="e.g. Chapter 4 Review"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-2xs text-zinc-400 block uppercase tracking-wider font-bold">Description</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none bg-[#fdfaf7] border-[#d4d2d0] text-zinc-800 focus:border-[#4a7c59]"
                  placeholder="Optional description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="border rounded-xl p-5 space-y-4 bg-white border-[#eae7e4]">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold font-sans tracking-tight text-zinc-900">
                Questions ({formQuestions.length})
              </h4>
              <button
                type="button"
                onClick={addQuestion}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#4a7c59] text-[#4a7c59] hover:bg-[#4a7c59] hover:text-white cursor-pointer transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Question
              </button>
            </div>

            {formQuestions.map((q, qi) => (
              <div key={qi} className="border rounded-lg p-4 bg-[#fdfaf7] border-[#eae7e4] space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-bold text-zinc-400 min-w-[16px]">{qi + 1}.</span>
                    <textarea
                      className="flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none bg-white border-[#d4d2d0] text-zinc-800 focus:border-[#4a7c59] resize-none"
                      rows={2}
                      placeholder="Enter question text..."
                      value={q.question}
                      onChange={(e) => updateQuestion(qi, e.target.value)}
                      required
                    />
                  </div>
                  {formQuestions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(qi)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCorrectAnswer(qi, oi)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 cursor-pointer transition-colors ${
                          q.correct_answer === oi
                            ? 'bg-emerald-500 text-white ring-2 ring-emerald-200'
                            : 'bg-zinc-200 text-zinc-500 hover:bg-zinc-300'
                        }`}
                        title={q.correct_answer === oi ? 'Correct answer' : 'Mark as correct'}
                      >
                        {String.fromCharCode(65 + oi)}
                      </button>
                      <input
                        type="text"
                        className="flex-1 px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none bg-white border-[#d4d2d0] text-zinc-800 focus:border-[#4a7c59]"
                        placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                        value={opt}
                        onChange={(e) => updateOption(qi, oi, e.target.value)}
                        required
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={goToList}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formTitle.trim()}
              className="px-5 py-2 text-xs font-semibold rounded-lg text-white bg-[#4a7c59] hover:bg-[#35583f] disabled:bg-zinc-200 cursor-pointer transition-colors flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? 'Saving...' : isEdit ? 'Update Quiz' : 'Create Quiz'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {isTeacher && (
        <div className="border rounded-xl p-5 grid grid-cols-1 sm:grid-cols-5 gap-4 items-end bg-white border-[#eae7e4]">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-2xs text-zinc-400 block uppercase tracking-wider font-bold">Topic</label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none bg-[#fdfaf7] border-[#d4d2d0]"
              placeholder="e.g. Photosynthesis"
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-2xs text-zinc-400 block uppercase tracking-wider font-bold">Difficulty</label>
            <select
              className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none bg-[#fdfaf7] border-[#d4d2d0] text-zinc-800"
              value={aiDifficulty}
              onChange={(e) => setAiDifficulty(e.target.value)}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-2xs text-zinc-400 block uppercase tracking-wider font-bold">Questions</label>
            <input
              type="number"
              min={1}
              max={20}
              className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none bg-[#fdfaf7] border-[#d4d2d0]"
              value={aiNumQuestions}
              onChange={(e) => setAiNumQuestions(Number(e.target.value))}
            />
          </div>
          <button
            type="button"
            onClick={handleGenerateAI}
            disabled={generatingAI || !aiTopic.trim()}
            className="w-full py-2 px-4 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 text-white cursor-pointer transition-colors bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-200"
          >
            {generatingAI ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Generate AI Quiz
              </>
            )}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold font-sans tracking-tight text-zinc-900">
          {quizzes.length} Quiz{quizzes.length !== 1 ? 'zes' : ''}
        </h3>
        {isTeacher && (
          <button
            onClick={startCreate}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white bg-[#4a7c59] hover:bg-[#35583f] cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Quiz
          </button>
        )}
      </div>

      <div className="space-y-3">
        {quizzes.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-8">
            {isTeacher ? 'No quizzes created yet.' : 'No quizzes available yet.'}
          </p>
        ) : (
          quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="border rounded-xl p-5 bg-white border-[#eae7e4] hover:border-zinc-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h5 className="font-bold text-sm tracking-tight text-zinc-900 truncate">{quiz.title}</h5>
                  <div className="flex items-center gap-2 mt-1 text-2xs text-zinc-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" />
                      {quiz.question_count || 0} Questions
                    </span>
                    <span>•</span>
                    <span>{quiz.created_at ? new Date(quiz.created_at).toLocaleDateString() : ''}</span>
                    {isTeacher && quiz.is_ai_generated && (
                      <>
                        <span>•</span>
                        <span className="px-2 py-0.5 rounded-full text-2xs font-bold border bg-purple-50 border-purple-200 text-purple-600">
                          AI Generated
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 ml-4 shrink-0">
                  <button
                    onClick={() => handleViewDetail(quiz.id)}
                    disabled={loadingDetail && selectedQuizId === quiz.id}
                    className="p-2 rounded-lg border border-[#eae7e4] text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 cursor-pointer transition-colors disabled:opacity-50"
                    title={isTeacher ? 'View Quiz' : 'Attempt Quiz'}
                  >
                    {isTeacher ? <Eye className="w-3.5 h-3.5" /> : <HelpCircle className="w-3.5 h-3.5" />}
                  </button>
                  {isTeacher && (
                    <>
                      <button
                        onClick={() => handleEdit(quiz.id)}
                        disabled={loadingDetail && selectedQuizId === quiz.id}
                        className="p-2 rounded-lg border border-[#eae7e4] text-zinc-500 hover:bg-zinc-50 hover:text-blue-600 cursor-pointer transition-colors disabled:opacity-50"
                        title="Edit Quiz"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(quiz.id)}
                        disabled={deletingId === quiz.id}
                        className="p-2 rounded-lg border border-[#eae7e4] text-zinc-500 hover:bg-red-50 hover:text-red-600 cursor-pointer transition-colors disabled:opacity-50"
                        title="Delete Quiz"
                      >
                        {deletingId === quiz.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
