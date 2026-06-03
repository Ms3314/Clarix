import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Edit3, Folder, HelpCircle, Users, Sparkles, Megaphone, CheckSquare,
  Plus, Trash2, FileText, Sigma, FlaskConical, Scroll,
} from 'lucide-react'
import api from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const ClassroomDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [classroom, setClassroom] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Overview')
  const [students, setStudents] = useState([])
  const [resources, setResources] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [announcements, setAnnouncements] = useState([])

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')

  const [announcementMsg, setAnnouncementMsg] = useState('')
  const [announcementPosting, setAnnouncementPosting] = useState(false)

  const [studentName, setStudentName] = useState('')
  const [studentEmail, setStudentEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [resourceFile, setResourceFile] = useState(null)

  const [quizTitle, setQuizTitle] = useState('')
  const [quizQuestions, setQuizQuestions] = useState(5)
  const [quizCreating, setQuizCreating] = useState(false)

  const [generatingAI, setGeneratingAI] = useState(false)
  const [aiMaterial, setAiMaterial] = useState(null)
  const [showAIModal, setShowAIModal] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [id])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [userRes, classRes] = await Promise.all([
        api.get('/auth/me'),
        api.get(`/classrooms/${id}`),
      ])
      setUser(userRes.data)
      const cls = { ...classRes.data, icon: classRes.data.icon || 'sigma' }
      setClassroom(cls)
      setEditName(cls.name)

      await Promise.all([
        fetchStudents(cls),
        fetchResources(cls),
        fetchQuizzes(cls),
        fetchAnnouncements(cls),
      ])
    } catch (error) {
      toast.error('Failed to load classroom')
      if (error.response?.status === 401) navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const fetchStudents = async (cls) => {
    try {
      const res = await api.get(`/classrooms/${cls.id}/students`)
      setStudents(res.data.students || [])
    } catch { setStudents([]) }
  }

  const fetchResources = async (cls) => {
    try {
      const res = await api.get(`/classrooms/${cls.id}/resources`)
      setResources(res.data.resources || [])
    } catch { setResources([]) }
  }

  const fetchQuizzes = async (cls) => {
    try {
      const res = await api.get(`/classrooms/${cls.id}/quizzes`)
      setQuizzes(res.data.quizzes || [])
    } catch { setQuizzes([]) }
  }

  const fetchAnnouncements = async (cls) => {
    try {
      const res = await api.get(`/classrooms/${cls.id}/announcements`)
      setAnnouncements(res.data.announcements || [])
    } catch { setAnnouncements([]) }
  }

  const saveEditedName = async (e) => {
    e.preventDefault()
    if (!editName.trim()) return
    try {
      await api.put(`/classrooms/${id}`, { name: editName })
      setClassroom((prev) => ({ ...prev, name: editName }))
      setIsEditing(false)
      toast.success('Name updated')
    } catch (err) {
      toast.error('Failed to update name')
    }
  }

  const handlePostAnnouncement = async (e) => {
    e.preventDefault()
    if (!announcementMsg.trim()) return
    setAnnouncementPosting(true)
    try {
      await api.post(`/classrooms/${id}/announcements`, {
        title: announcementMsg.slice(0, 50),
        content: announcementMsg,
      })
      toast.success('Announcement posted!')
      setAnnouncementMsg('')
      fetchAnnouncements(classroom)
    } catch (err) {
      toast.error('Failed to post announcement')
    } finally {
      setAnnouncementPosting(false)
    }
  }

  const handleDeleteAnnouncement = async (annId) => {
    try {
      await api.delete(`/classrooms/${id}/announcements/${annId}`)
      toast.success('Announcement deleted')
      fetchAnnouncements(classroom)
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleInviteStudent = async (e) => {
    e.preventDefault()
    if (!studentEmail.trim()) return
    setInviteLoading(true)
    try {
      await api.post(`/classrooms/${id}/invite`, { email: studentEmail.trim() })
      toast.success('Student invited!')
      setStudentEmail('')
      setStudentName('')
      fetchStudents(classroom)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to invite')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are allowed')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB')
      return
    }

    setUploading(true)
    try {
      const { data: urlData } = await api.post(`/classrooms/${id}/resources/generate-upload-url`, {
        filename: file.name,
        file_size: file.size,
      })

      const { upload_url: uploadUrl, file_path: filePath } = urlData

      const { error: uploadError } = await supabase.storage
        .from('classroom-resources')
        .upload(filePath, file, {
          contentType: 'application/pdf',
          upsert: false,
        })

      if (uploadError) throw uploadError

      await api.post(`/classrooms/${id}/resources`, {
        filename: file.name,
        file_size: file.size,
        file_path: filePath,
      })

      toast.success('Resource uploaded successfully!')
      fetchResources(classroom)
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Upload failed')
    } finally {
      setUploading(false)
      setResourceFile(null)
    }
  }

  const handleDeleteResource = async (resourceId) => {
    try {
      await api.delete(`/classrooms/${id}/resources/${resourceId}`)
      toast.success('Resource deleted')
      fetchResources(classroom)
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleCreateQuiz = async (e) => {
    e.preventDefault()
    if (!quizTitle.trim()) return
    setQuizCreating(true)
    try {
      await api.post(`/classrooms/${id}/quizzes`, {
        title: quizTitle,
        description: `${quizQuestions} questions`,
        questions: [],
        is_ai_generated: false,
      })
      toast.success('Quiz created!')
      setQuizTitle('')
      fetchQuizzes(classroom)
    } catch (err) {
      toast.error('Failed to create quiz')
    } finally {
      setQuizCreating(false)
    }
  }

  const handleGenerateReview = async () => {
    setGeneratingAI(true)
    setAiMaterial(null)
    try {
      const res = await api.post(`/classrooms/${id}/chat`, {
        query: `Generate a comprehensive review sheet for "${classroom.name}" covering all key topics. Include study tips and practice questions.`,
      })
      const content = res.data.response || 'No content generated.'
      setAiMaterial(content)
      setShowAIModal(true)
    } catch (err) {
      toast.error('Failed to generate review')
    } finally {
      setGeneratingAI(false)
    }
  }

  const saveAIToResources = async () => {
    if (!aiMaterial) return
    const blob = new Blob([aiMaterial], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Review-${classroom.name}-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    toast.success('Review downloaded! Upload it as a PDF resource in the Resources tab.')
    setShowAIModal(false)
  }

  const getIcon = (iconName) => {
    switch (iconName) {
      case 'sigma': return <Sigma className="w-4 h-4" />
      case 'flask': return <FlaskConical className="w-4 h-4" />
      case 'scroll': return <Scroll className="w-4 h-4" />
      default: return <Sigma className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 min-h-[60vh]">
        <div className="text-lg text-zinc-400">Loading classroom...</div>
      </div>
    )
  }

  if (!classroom) {
    return (
      <div className="flex items-center justify-center p-12 min-h-[60vh]">
        <div className="text-lg text-zinc-400">Classroom not found</div>
      </div>
    )
  }

  const tabs = ['Overview', 'Announcements', 'Students', 'Resources', 'Quizzes']
  const isTeacher = user?.role === 'teacher'

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6 select-none">
        {/* Top Navigation Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-200">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 border border-[#eae6e1] hover:bg-[#faf7f3] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            {isEditing ? (
              <form onSubmit={saveEditedName} className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="px-3 py-1 text-lg font-serif italic border focus:outline-none bg-white border-zinc-900 text-zinc-900"
                  autoFocus
                />
                <button type="submit" className="px-2.5 py-1 text-xs uppercase tracking-wider font-bold bg-[#1c1b1a] text-white cursor-pointer hover:bg-amber-600 border border-zinc-900">
                  Save
                </button>
                <button type="button" onClick={() => setIsEditing(false)} className="px-2.5 py-1 text-xs uppercase tracking-wider font-bold bg-zinc-500 text-white cursor-pointer hover:bg-zinc-400 border border-transparent">
                  Cancel
                </button>
              </form>
            ) : (
              <div className="flex items-start gap-3">
                <div>
                  <span className="text-[9px] font-mono tracking-widest text-[#b45309] uppercase block mb-1">
                    Workspace Archives / Ref: {classroom.invite_code}
                  </span>
                  <h1 className="text-2xl lg:text-3xl font-serif font-semibold italic tracking-tight leading-none text-[#1c1b1a]">
                    {classroom.name}
                  </h1>
                </div>
              </div>
            )}
          </div>

          {isTeacher && (
            <button
              onClick={() => { setIsEditing(true); setEditName(classroom.name) }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-wider font-semibold border transition-all cursor-pointer border-zinc-300 hover:border-[#1c1b1a] hover:bg-[#1c1b1a] hover:text-white text-zinc-700 bg-transparent"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Class Label
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 border-b border-zinc-200">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest relative whitespace-nowrap cursor-pointer ${
                activeTab === tab
                  ? 'text-zinc-900 border-b-2 border-zinc-900 font-bold'
                  : 'text-zinc-400 hover:text-zinc-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'Overview' && (
          <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { label: 'Resources', icon: Folder, count: resources.length, tab: 'Resources' },
                { label: 'Quizzes', icon: HelpCircle, count: quizzes.length, tab: 'Quizzes' },
                { label: 'Students', icon: Users, count: students.length, tab: 'Students' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="border-l-2 p-5 flex flex-col justify-between h-[120px] transition-all duration-300 bg-white border-zinc-900 border-t border-r border-b border-zinc-150"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
                      {item.label}
                    </span>
                    <span className="p-1.5 border bg-[#faf7f3] border-zinc-150">
                      <item.icon className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="flex items-end justify-between mt-2">
                    <span className="text-4xl font-serif font-semibold italic text-zinc-900">
                      {item.count}
                    </span>
                    <button
                      onClick={() => setActiveTab(item.tab)}
                      className="text-xs font-bold uppercase tracking-widest hover:underline text-[#1c1b1a]"
                    >
                      Inspect →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
              {/* Activity Timeline */}
              <div className="lg:col-span-2 border rounded-2xl p-6 bg-[#fdfaf7]/40 border-[#eae7e4]">
                <h3 className="text-lg font-bold font-sans tracking-tight mb-6 flex items-center gap-2 text-[#1c1b1a]">
                  Recent Activity
                </h3>
                <div className="space-y-6 relative before:absolute before:inset-y-1 before:left-[19px] before:w-0.5 before:bg-zinc-200">
                  {resources.length === 0 && announcements.length === 0 && quizzes.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-8">No activity yet. Start by adding resources or posting announcements.</p>
                  ) : (
                    <>
                      {resources.slice(0, 2).map((res) => (
                        <div key={res.id} className="relative pl-10 flex items-start gap-4">
                          <span className="absolute left-0 p-1.5 rounded-full border bg-white border-zinc-100 text-[#4a7c59] z-10">
                            <FileText className="w-3.5 h-3.5" />
                          </span>
                          <div className="p-4 rounded-xl border flex-1 space-y-1 bg-white border-[#eae7e4] text-zinc-700">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono font-semibold text-emerald-500">Resource Uploaded</span>
                              <span className="text-2xs font-mono text-zinc-400">{res.created_at ? new Date(res.created_at).toLocaleDateString() : 'Recently'}</span>
                            </div>
                            <p className="text-sm font-sans font-medium line-clamp-1 text-zinc-950">"{res.filename}" was compiled to classroom folders.</p>
                          </div>
                        </div>
                      ))}
                      {announcements.slice(0, 1).map((ann) => (
                        <div key={ann.id} className="relative pl-10 flex items-start gap-4">
                          <span className="absolute left-0 p-1.5 rounded-full border bg-white border-zinc-100 text-amber-500 z-10">
                            <Megaphone className="w-3.5 h-3.5" />
                          </span>
                          <div className="p-4 rounded-xl border flex-1 space-y-1 bg-white border-[#eae7e4] text-zinc-700">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono font-semibold text-[#8c52ff]">Announcement</span>
                              <span className="text-2xs font-mono text-zinc-400">{ann.created_at ? new Date(ann.created_at).toLocaleDateString() : ''}</span>
                            </div>
                            <p className="text-sm font-sans line-clamp-2 text-zinc-950">{ann.content}</p>
                          </div>
                        </div>
                      ))}
                      {quizzes.slice(0, 1).map((quiz) => (
                        <div key={quiz.id} className="relative pl-10 flex items-start gap-4">
                          <span className="absolute left-0 p-1.5 rounded-full border bg-white border-zinc-100 text-teal-500 z-10">
                            <CheckSquare className="w-3.5 h-3.5" />
                          </span>
                          <div className="p-4 rounded-xl border flex-1 space-y-1 bg-white border-[#eae7e4] text-zinc-700">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono font-semibold text-teal-400">Quiz Published</span>
                              <span className="text-2xs font-mono text-zinc-400">{quiz.created_at ? new Date(quiz.created_at).toLocaleDateString() : ''}</span>
                            </div>
                            <p className="text-sm font-sans line-clamp-1 text-zinc-950">"{quiz.title}" is now active with {quiz.question_count || 0} questions.</p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Right Widgets */}
              <div className="space-y-6">
                {/* AI Insights */}
                <div className="rounded-2xl border p-6 flex flex-col justify-between transition-colors duration-300 bg-gradient-to-b from-white to-[#fbf9f6] border-[#eae7e4] text-[#1c1b1a]">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-green-150 text-[#4a7c59]">
                        <Sparkles className="w-4 h-4 animate-pulse" />
                      </span>
                      <h4 className="font-bold text-sm tracking-tight font-sans">AI Insights</h4>
                    </div>
                    <p className="text-xs leading-relaxed font-sans text-zinc-600">
                      Based on available resources, you can generate a comprehensive review sheet for your students covering all key topics in <strong>"{classroom.name}"</strong>.
                    </p>
                  </div>
                  <div className="pt-5 border-t border-dashed mt-4 border-zinc-100">
                    <button
                      onClick={handleGenerateReview}
                      disabled={generatingAI}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-semibold rounded-xl cursor-pointer transition-all active:scale-95 text-white bg-[#4a7c59] hover:bg-[#35583f] disabled:bg-zinc-200"
                    >
                      {generatingAI ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Generating...
                        </>
                      ) : (
                        'Generate Review Material →'
                      )}
                    </button>
                  </div>
                </div>

                {/* Upcoming */}
                <div className="rounded-2xl border p-6 space-y-4 bg-white border-[#eae7e4]">
                  <h4 className="font-bold text-sm tracking-tight font-sans text-zinc-900">Upcoming</h4>
                  <p className="text-xs text-zinc-400">No upcoming events scheduled.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Announcements Tab */}
        {activeTab === 'Announcements' && (
          <div className="space-y-6 animate-fade-in max-w-4xl">
            {isTeacher && (
              <form
                onSubmit={handlePostAnnouncement}
                className="border rounded-xl p-5 space-y-4 bg-white border-[#eae7e4]"
              >
                <h4 className="text-sm font-bold font-sans tracking-tight">Post New Announcement</h4>
                <textarea
                  className="w-full h-24 p-3 rounded-lg border text-sm focus:outline-none bg-[#fdfaf7] border-[#d4d2d0] text-zinc-800 placeholder:text-zinc-400 focus:border-[#4a7c59]"
                  placeholder="What would you like to share with your students today?"
                  value={announcementMsg}
                  onChange={(e) => setAnnouncementMsg(e.target.value)}
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={announcementPosting || !announcementMsg.trim()}
                    className="py-2 px-4 text-xs font-semibold rounded-lg text-white cursor-pointer transition-colors bg-[#4a7c59] hover:bg-[#32533c] disabled:bg-zinc-200"
                  >
                    {announcementPosting ? 'Posting...' : 'Publish Announcement'}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-4">
              {announcements.length === 0 ? (
                <p className="text-sm text-zinc-400 font-mono text-center py-6">No announcements shared yet.</p>
              ) : (
                announcements.map((ann) => (
                  <div key={ann.id} className="border rounded-xl p-5 bg-white border-[#eae7e4]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-xs text-indigo-700">
                          {(ann.teacher_name || 'T').charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-xs leading-none">{ann.teacher_name || 'Teacher'}</h4>
                          <span className="text-3xs font-mono text-zinc-400 leading-none mt-0.5 block">
                            {ann.created_at ? new Date(ann.created_at).toLocaleDateString() : ''}
                          </span>
                        </div>
                      </div>
                      {isTeacher && (
                        <button
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {ann.title && <p className="text-xs font-semibold text-zinc-600 mb-1">{ann.title}</p>}
                    <p className="text-sm leading-relaxed">{ann.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Students Tab */}
        {activeTab === 'Students' && (
          <div className="space-y-6 animate-fade-in max-w-4xl">
            {isTeacher && (
              <form
                onSubmit={handleInviteStudent}
                className="border rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-white border-[#eae7e4]"
              >
                <div className="space-y-1.5">
                  <label className="text-2xs font-mono text-zinc-400 block">Student Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none bg-[#fdfaf7] border-[#d4d2d0]"
                    placeholder="e.g. Alishba Khan"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-2xs font-mono text-zinc-400 block">Student Email</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none bg-[#fdfaf7] border-[#d4d2d0]"
                    placeholder="e.g. khan@student.com"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={inviteLoading || !studentEmail.trim()}
                  className="w-full py-2 px-4 text-xs font-semibold rounded-lg text-white cursor-pointer transition-colors bg-[#4a7c59] hover:bg-[#32533c] disabled:bg-zinc-200"
                >
                  {inviteLoading ? 'Inviting...' : 'Add Student'}
                </button>
              </form>
            )}

            <div className="border rounded-xl overflow-hidden border-[#eae7e4]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-2xs font-mono text-zinc-400 uppercase border-b bg-zinc-50 border-[#eae7e4]">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Joined</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-zinc-100">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-zinc-400 font-mono">No students enrolled yet.</td>
                    </tr>
                  ) : (
                    students.map((student) => (
                      <tr key={student.id} className="text-zinc-800">
                        <td className="py-3 px-4 flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-extrabold text-2xs leading-none">
                            {(student.username || student.email || 'S').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold">{student.username || student.email}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-400">{student.email || '—'}</td>
                        <td className="py-3 px-4 text-zinc-400">{student.enrolled_at ? new Date(student.enrolled_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Resources Tab */}
        {activeTab === 'Resources' && (
          <div className="space-y-6 animate-fade-in max-w-4xl">
            {isTeacher && (
              <div className="border rounded-xl p-5 space-y-4 bg-white border-[#eae7e4]">
                <h4 className="text-sm font-bold font-sans tracking-tight">Upload Resource</h4>
                <div className="border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center">
                  <FileText className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
                  <p className="text-sm text-zinc-500 mb-3">Drag and drop a PDF file, or click to browse</p>
                  <label className="inline-block py-2 px-4 text-xs font-semibold rounded-lg text-white cursor-pointer bg-[#4a7c59] hover:bg-[#32533c]">
                    {uploading ? 'Uploading...' : 'Browse Files'}
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                  <p className="text-2xs text-zinc-400 mt-2">PDF files up to 10MB</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {resources.length === 0 ? (
                <p className="sm:col-span-2 text-sm text-zinc-400 font-mono text-center py-6">No resources uploaded yet.</p>
              ) : (
                resources.map((res) => (
                  <div
                    key={res.id}
                    className="border rounded-xl p-5 flex items-start gap-4 bg-white border-[#eae7e4]"
                  >
                    <div className="p-2 rounded-lg border bg-zinc-50 border-zinc-100 text-[#4a7c59]">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="font-bold text-sm tracking-tight text-zinc-900">{res.filename}</h5>
                        {isTeacher && (
                          <button
                            onClick={() => handleDeleteResource(res.id)}
                            className="p-1 text-zinc-400 hover:text-red-500 transition-colors shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-3xs font-mono text-zinc-400">
                        <span className="uppercase">PDF</span>
                        <span>•</span>
                        <span>{res.file_size ? `${(res.file_size / 1024).toFixed(0)} KB` : ''}</span>
                        <span>•</span>
                        <span>{res.indexed ? 'Indexed' : 'Pending'}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Quizzes Tab */}
        {activeTab === 'Quizzes' && (
          <div className="space-y-6 animate-fade-in max-w-4xl">
            {isTeacher && (
              <form
                onSubmit={handleCreateQuiz}
                className="border rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end bg-white border-[#eae7e4]"
              >
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-2xs font-mono text-zinc-400 block">Quiz Title</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none bg-[#fdfaf7] border-[#d4d2d0]"
                    placeholder="e.g. Chapter 4 review"
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-2xs font-mono text-zinc-400 block">Questions</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none bg-[#fdfaf7] border-[#d4d2d0]"
                    value={quizQuestions}
                    onChange={(e) => setQuizQuestions(Number(e.target.value))}
                  />
                </div>
                <button
                  type="submit"
                  disabled={quizCreating || !quizTitle.trim()}
                  className="w-full py-2 px-4 text-xs font-semibold rounded-lg text-white cursor-pointer transition-colors bg-[#4a7c59] hover:bg-[#32533c] disabled:bg-zinc-200"
                >
                  {quizCreating ? 'Creating...' : 'Add Quiz'}
                </button>
              </form>
            )}

            <div className="space-y-4">
              {quizzes.length === 0 ? (
                <p className="text-sm text-zinc-400 font-mono text-center py-6">No quizzes created yet.</p>
              ) : (
                quizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="border rounded-xl p-5 flex items-center justify-between bg-white border-[#eae7e4]"
                  >
                    <div>
                      <h5 className="font-bold text-sm tracking-tight text-zinc-900">{quiz.title}</h5>
                      <div className="flex items-center gap-2 mt-1 text-3xs font-mono text-zinc-400">
                        <span>{quiz.question_count || 0} Questions</span>
                        <span>•</span>
                        <span>{quiz.created_at ? new Date(quiz.created_at).toLocaleDateString() : ''}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-2xs font-mono font-bold border bg-teal-50 border-teal-200 text-teal-600">
                      {quiz.is_ai_generated ? 'AI Generated' : 'Published'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* AI Modal */}
      {showAIModal && aiMaterial && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border p-6 space-y-4 shadow-xl bg-white border-[#eae7e4] text-[#1c1b1a]">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2 text-[#4a7c59]">
                <Sparkles className="w-5 h-5 animate-pulse" />
                <h3 className="font-bold text-base font-sans tracking-tight">Generated Review Material</h3>
              </div>
              <button onClick={() => setShowAIModal(false)} className="text-zinc-400 hover:text-zinc-900 font-semibold cursor-pointer text-sm">
                Close
              </button>
            </div>
            <div className="max-h-[350px] overflow-y-auto p-4 rounded-xl border font-sans text-xs leading-relaxed space-y-3 border-zinc-100 bg-[#fdfaf7]/30 whitespace-pre-wrap">
              {aiMaterial}
            </div>
            <div className="flex flex-wrap gap-3 justify-end pt-3 border-t border-zinc-100">
              <button
                onClick={() => {
                  const blob = new Blob([aiMaterial], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `Review-${classroom.name}-${new Date().toISOString().split('T')[0]}.txt`
                  a.click()
                }}
                className="py-2 px-4 rounded-xl text-xs font-semibold border cursor-pointer transition-colors border-[#eae7e4] text-zinc-500 hover:bg-zinc-50 bg-white"
              >
                Download (.txt)
              </button>
              <button
                onClick={saveAIToResources}
                className="py-2 px-4 rounded-xl text-xs font-semibold text-white cursor-pointer transition-all bg-[#4a7c59] hover:bg-[#35583f]"
              >
                Save to Resources
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClassroomDetail
