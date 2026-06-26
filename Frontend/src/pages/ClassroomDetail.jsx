import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Edit3, Folder, HelpCircle, Users, Sparkles, Megaphone, CheckSquare,
  Trash2, FileText, Link, X, MoreVertical,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import ResourceBrowser from '@/components/classroom/ResourceBrowser'
import PdfViewerPanel from '@/components/classroom/PdfViewerPanel'
import ClassroomSettings from '@/components/classroom/ClassroomSettings'
import QuizTab from '@/components/classroom/QuizTab'
import api from '@/lib/api'
import { toast } from 'sonner'
import useAuthStore from '@/stores/authStore'
import useClassroomDetailStore from '@/stores/classroomDetailStore'
import useUploadStore from '@/stores/uploadStore'
import { Loading } from '@/components/ui/loading'

const ClassroomDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const numericId = Number(id)

  const user = useAuthStore((s) => s.user)
  const {
    getEntityData, getEntityLoading, invalidateEntity, setEntityData,
    fetchClassroom: fetchClassroomStore, fetchPending: fetchPendingStore,
    fetchStudents: fetchStudentsStore, fetchResources: fetchResourcesStore,
    fetchAnnouncements: fetchAnnouncementsStore,
    fetchFolders: fetchFoldersStore,
  } = useClassroomDetailStore()

  const entityFetchers = {
    classroom: fetchClassroomStore,
    students: fetchStudentsStore,
    resources: fetchResourcesStore,
    quizzes: fetchQuizzesStore,
    announcements: fetchAnnouncementsStore,
    folders: fetchFoldersStore,
    pending: fetchPendingStore,
  }

  const TAB_ENTITIES = {
    Overview: ['classroom', 'students', 'resources', 'quizzes'],
    Announcements: ['announcements'],
    Resources: ['resources', 'folders'],
    Quizzes: ['quizzes'],
    Students: ['students', 'pending'],
    Settings: [],
  }

  const classroom = getEntityData(numericId, 'classroom')
  const students = getEntityData(numericId, 'students') || []
  const resources = getEntityData(numericId, 'resources') || []
  const quizzes = getEntityData(numericId, 'quizzes') || []
  const announcements = getEntityData(numericId, 'announcements') || []
  const folders = getEntityData(numericId, 'folders') || []
  const pendingStudents = getEntityData(numericId, 'pending') || []

  const classroomLoading = getEntityLoading(numericId, 'classroom')
  const [activeTab, setActiveTab] = useState('Overview')
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [announcementMsg, setAnnouncementMsg] = useState('')
  const [announcementPosting, setAnnouncementPosting] = useState(false)
  const [studentName, setStudentName] = useState('')
  const [studentEmail, setStudentEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [dialogFiles, setDialogFiles] = useState([])
  const [dialogFileTypes, setDialogFileTypes] = useState([])
  const [actionLoading, setActionLoading] = useState(null)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [aiMaterial, setAiMaterial] = useState(null)
  const [showAIModal, setShowAIModal] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState(null)
  const [viewingResource, setViewingResource] = useState(null)
  const [deletingItem, setDeletingItem] = useState(null)
  const [deletingLoading, setDeletingLoading] = useState(false)
  const uploadActive = useUploadStore((s) => s.queue.some((q) => q.status === 'pending' || q.status === 'uploading'))

  useEffect(() => {
    const entities = TAB_ENTITIES[activeTab] || []
    Promise.all(entities.map(e => entityFetchers[e](numericId)))
      .catch((error) => {
        toast.error('Failed to load classroom')
        if (error.response?.status === 401) navigate('/')
      })
  }, [numericId, activeTab])

  const saveEditedName = async (e) => {
    e.preventDefault()
    if (!editName.trim()) return
    try {
      await api.put(`/classrooms/${numericId}`, { name: editName })
      setEntityData(numericId, 'classroom', { ...classroom, name: editName })
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
      await api.post(`/classrooms/${numericId}/announcements`, {
        title: announcementMsg.slice(0, 50),
        content: announcementMsg,
      })
      toast.success('Announcement posted!')
      setAnnouncementMsg('')
      invalidateEntity(numericId, 'announcements')
      fetchAnnouncementsStore(numericId, true)
    } catch (err) {
      toast.error('Failed to post announcement')
    } finally {
      setAnnouncementPosting(false)
    }
  }

  const handleDeleteAnnouncement = async (annId) => {
    try {
      await api.delete(`/classrooms/${numericId}/announcements/${annId}`)
      toast.success('Announcement deleted')
      invalidateEntity(numericId, 'announcements')
      fetchAnnouncementsStore(numericId, true)
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleInviteStudent = async (e) => {
    e.preventDefault()
    if (!studentEmail.trim()) return
    setInviteLoading(true)
    try {
      await api.post(`/classrooms/${numericId}/invite`, { email: studentEmail.trim() })
      toast.success('Student invited!')
      setStudentEmail('')
      setStudentName('')
      invalidateEntity(numericId, 'students')
      fetchStudentsStore(numericId, true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to invite')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleApproveStudent = async (studentId) => {
    setActionLoading(studentId)
    try {
      await api.post(`/classrooms/${numericId}/pending/${studentId}/approve`)
      toast.success('Student approved!')
      invalidateEntity(numericId, 'pending')
      invalidateEntity(numericId, 'students')
      fetchPendingStore(numericId, true)
      fetchStudentsStore(numericId, true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to approve')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectStudent = async (studentId) => {
    setActionLoading(studentId)
    try {
      await api.delete(`/classrooms/${numericId}/pending/${studentId}/reject`)
      toast.success('Request rejected')
      invalidateEntity(numericId, 'pending')
      fetchPendingStore(numericId, true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reject')
    } finally {
      setActionLoading(null)
    }
  }

  const handleFileSelected = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const valid = []
    for (const f of files) {
      if (!f.name.toLowerCase().endsWith('.pdf')) {
        toast.error(`"${f.name}" is not a PDF`)
        continue
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`"${f.name}" exceeds 10MB limit`)
        continue
      }
      valid.push(f)
    }

    if (valid.length === 0) return

    setDialogFiles(valid)
    setDialogFileTypes(valid.map(() => 'notes'))
    setShowUploadDialog(true)
    e.target.value = ''
  }

  const handleConfirmUpload = () => {
    if (dialogFiles.length === 0) return
    useUploadStore.getState().addFiles(dialogFiles, dialogFileTypes, numericId, selectedFolderId)
    setShowUploadDialog(false)
    setDialogFiles([])
    setDialogFileTypes([])
  }

  const handleCreateFolder = async (name, parentId) => {
    if (!name.trim()) return
    try {
      await api.post(`/classrooms/${numericId}/folders`, { name: name.trim(), parent_id: parentId || null })
      invalidateEntity(numericId, 'folders')
      fetchFoldersStore(numericId, true)
      toast.success('Folder created')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create folder')
    }
  }

  const handleMoveResource = async (resourceId, folderId) => {
    try {
      await api.put(`/classrooms/${numericId}/resources/${resourceId}/move`, { folder_id: folderId })
      invalidateEntity(numericId, 'resources')
      fetchResourcesStore(numericId, true)
      toast.success('Resource moved')
    } catch { toast.error('Failed to move resource') }
  }

  const handleDeleteResource = async (resourceId) => {
    try {
      await api.delete(`/classrooms/${numericId}/resources/${resourceId}`)
      toast.success('Resource deleted')
      invalidateEntity(numericId, 'resources')
      fetchResourcesStore(numericId, true)
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleDeleteFolder = async (folderId) => {
    try {
      await api.delete(`/classrooms/${numericId}/folders/${folderId}`)
      invalidateEntity(numericId, 'folders')
      fetchFoldersStore(numericId, true)
      if (selectedFolderId === folderId) setSelectedFolderId(null)
      toast.success('Folder deleted')
    } catch { toast.error('Failed to delete folder') }
  }

  const requestDelete = (type, id) => {
    const name = type === 'resource'
      ? resources.find(r => r.id === id)?.filename
      : folders.find(f => f.id === id)?.name
    setDeletingItem({ type, id, name: name || 'this item' })
  }

  const confirmDelete = async () => {
    if (!deletingItem) return
    setDeletingLoading(true)
    if (deletingItem.type === 'resource') {
      await handleDeleteResource(deletingItem.id)
    } else {
      await handleDeleteFolder(deletingItem.id)
    }
    setDeletingLoading(false)
    setDeletingItem(null)
  }

  const handleCreateQuiz = async (e) => {
    e.preventDefault()
    if (!quizTitle.trim()) return
    setQuizCreating(true)
    try {
      await api.post(`/classrooms/${numericId}/quizzes`, {
        title: quizTitle,
        description: `${quizQuestions} questions`,
        questions: [],
        is_ai_generated: false,
      })
      toast.success('Quiz created!')
      setQuizTitle('')
      invalidateEntity(numericId, 'quizzes')
      fetchQuizzesStore(numericId, true)
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
      const res = await api.post(`/classrooms/${numericId}/chat`, {
        query: `Generate a comprehensive review sheet for "${classroom?.name}" covering all key topics. Include study tips and practice questions.`,
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
    a.download = `Review-${classroom?.name}-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    toast.success('Review downloaded! Upload it as a PDF resource in the Resources tab.')
    setShowAIModal(false)
  }

  if (!classroom && classroomLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loading size="lg" />
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

  const isTeacher = user?.role === 'teacher'

  const featureTabs = [
    { key: 'Announcements', flag: classroom?.announcements_enabled ?? true },
    { key: 'Resources', flag: classroom?.resources_enabled ?? true },
    { key: 'Quizzes', flag: classroom?.quizzes_enabled ?? true },
  ]

  const baseTabs = ['Overview', 'Students']
  const extraTabs = featureTabs.filter((t) => t.flag).map((t) => t.key)
  const settingsTab = isTeacher ? ['Settings'] : []
  const tabs = [...baseTabs, ...extraTabs, ...settingsTab]

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
                  className="px-3 py-1 text-lg font-serif  border focus:outline-none bg-white border-zinc-900 text-zinc-900"
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
                  <h1 className="text-2xl lg:text-3xl font-serif font-semibold  tracking-tight leading-none text-[#1c1b1a]">
                    {classroom.name}
                  </h1>
                </div>
              </div>
            )}
          </div>

          {isTeacher && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center w-8 h-8 rounded border border-zinc-300 text-zinc-500 hover:bg-zinc-100 hover:border-zinc-400 transition-all cursor-pointer">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                <DropdownMenuItem
                  onClick={() => { setIsEditing(true); setEditName(classroom.name) }}
                  className="text-xs gap-2 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Class Label
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const link = `${window.location.origin}/join/${classroom.invite_code}`
                    navigator.clipboard.writeText(link)
                    toast.success('Join link copied!')
                  }}
                  className="text-xs gap-2 cursor-pointer"
                >
                  <Link className="w-3.5 h-3.5" />
                  Share Link
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                ...(classroom?.resources_enabled ?? true ? [{ label: 'Resources', icon: Folder, count: resources.length, tab: 'Resources' }] : []),
                ...(classroom?.quizzes_enabled ?? true ? [{ label: 'Quizzes', icon: HelpCircle, count: quizzes.length, tab: 'Quizzes' }] : []),
                { label: 'Students', icon: Users, count: students.length, tab: 'Students' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="border-l-2 p-5 flex flex-col justify-between h-[120px] transition-all duration-300 bg-white border-zinc-900 border-t border-r border-b border-zinc-150"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]  uppercase tracking-widest text-zinc-400">
                      {item.label}
                    </span>
                    <span className="p-1.5 border bg-[#faf7f3] border-zinc-150">
                      <item.icon className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="flex items-end justify-between mt-2">
                    <span className="text-4xl font-serif font-semibold  text-zinc-900">
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
                              <span className="text-xs  font-semibold text-emerald-500">Resource Uploaded</span>
                              <span className="text-2xs  text-zinc-400">{res.created_at ? new Date(res.created_at).toLocaleDateString() : 'Recently'}</span>
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
                              <span className="text-xs  font-semibold text-[#8c52ff]">Announcement</span>
                              <span className="text-2xs  text-zinc-400">{ann.created_at ? new Date(ann.created_at).toLocaleDateString() : ''}</span>
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
                              <span className="text-xs  font-semibold text-teal-400">Quiz Published</span>
                              <span className="text-2xs  text-zinc-400">{quiz.created_at ? new Date(quiz.created_at).toLocaleDateString() : ''}</span>
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
              {/* <div className="space-y-6">
                {/* AI Insights */}
                {/* <div className="rounded-2xl border p-6 flex flex-col justify-between transition-colors duration-300 bg-gradient-to-b from-white to-[#fbf9f6] border-[#eae7e4] text-[#1c1b1a]">
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
                </div> */}

                {/* Upcoming */}
                {/* <div className="rounded-2xl border p-6 space-y-4 bg-white border-[#eae7e4]">
                  <h4 className="font-bold text-sm tracking-tight font-sans text-zinc-900">Upcoming</h4>
                  <p className="text-xs text-zinc-400">No upcoming events scheduled.</p>
                </div> */}
              {/* </div> */}
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
                <p className="text-sm text-zinc-400  text-center py-6">No announcements shared yet.</p>
              ) : (
                announcements.map((ann) => (
                  <div key={ann.id} className="border rounded-xl p-5 bg-white border-[#eae7e4]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-xs text-indigo-700">
                          {(ann.teacher_name || 'T').charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-xs leading-none">{ann.teacher_name || 'Teacher'}</h4>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 leading-none">Instructor</span>
                          </div>
                          <span className="text-3xs  text-zinc-400 leading-none mt-0.5 block">
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
                  <label className="text-2xs  text-zinc-400 block">Student Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none bg-[#fdfaf7] border-[#d4d2d0]"
                    placeholder="e.g. Alishba Khan"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-2xs  text-zinc-400 block">Student Email</label>
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

            {/* Pending Requests */}
            {isTeacher && pendingStudents.length > 0 && (
              <div className="border rounded-xl overflow-hidden border-[#eae7e4]">
                <div className="px-4 py-3 bg-zinc-50 border-b border-[#eae7e4]">
                  <span className="text-2xs  font-bold tracking-wider text-zinc-500 uppercase">
                    Pending Requests ({pendingStudents.length})
                  </span>
                </div>
                <div className="divide-y divide-zinc-100">
                  {pendingStudents.map((student) => (
                    <div key={student.id} className="px-4 py-3 flex items-center justify-between bg-white">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center font-extrabold text-2xs">
                          {(student.username || student.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-800">{student.username || student.email}</p>
                          <p className="text-2xs  text-zinc-400">{student.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveStudent(student.id)}
                          disabled={actionLoading === student.id}
                          className="px-3 py-1.5 text-2xs font-bold uppercase tracking-wider rounded-lg text-white bg-[#4a7c59] hover:bg-[#3d6b4c] transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {actionLoading === student.id ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleRejectStudent(student.id)}
                          disabled={actionLoading === student.id}
                          className="px-3 py-1.5 text-2xs font-bold uppercase tracking-wider rounded-lg text-zinc-500 bg-white border border-[#eae7e4] hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {actionLoading === student.id ? '...' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border rounded-xl overflow-hidden border-[#eae7e4]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-2xs  text-zinc-400 uppercase border-b bg-zinc-50 border-[#eae7e4]">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Joined</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-zinc-100">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-zinc-400 ">No students enrolled yet.</td>
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
                        <td className="py-3 px-4  text-zinc-400">{student.email || '—'}</td>
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
          <div className="animate-fade-in">
            <ResourceBrowser
              folders={folders}
              resources={resources}
              isTeacher={isTeacher}
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
              onOpenFile={setViewingResource}
              onDeleteResource={(id) => requestDelete('resource', id)}
              onDeleteFolder={(id) => requestDelete('folder', id)}
              onCreateFolder={handleCreateFolder}
              onMoveResource={handleMoveResource}
              onUploadFiles={handleFileSelected}
              uploadActive={uploadActive}
            />

            {viewingResource && (
              <PdfViewerPanel
                resource={viewingResource}
                user={user}
                classroomId={numericId}
                onClose={() => setViewingResource(null)}
              />
            )}
          </div>
        )}

        {/* Quizzes Tab */}
        {activeTab === 'Quizzes' && (
          <QuizTab classroomId={numericId} isTeacher={isTeacher} />
        )}

        {/* Settings Tab */}
        {activeTab === 'Settings' && isTeacher && (
          <ClassroomSettings
            classroom={classroom}
            numericId={numericId}
            onSaved={(data) => {
              setEntityData(numericId, 'classroom', data)
            }}
          />
        )}
      </div>

      {/* AI Modal */}
      {/* Upload confirmation dialog */}
      {showUploadDialog && dialogFiles.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowUploadDialog(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-800">Confirm Upload</h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
                {dialogFiles.length} file{dialogFiles.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="px-5 py-4 space-y-3 max-h-96 overflow-y-auto">
              <p className="text-xs text-zinc-500 font-medium">Set type for each file:</p>
              {dialogFiles.map((f, i) => {
                const type = dialogFileTypes[i] || 'notes'
                const setType = (t) => {
                  const next = [...dialogFileTypes]
                  next[i] = t
                  setDialogFileTypes(next)
                }
                const chip = (t, label, activeColor, color) => (
                  <button
                    type="button"
                    onClick={() => setType(t)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer transition-all shrink-0 ${type === t ? activeColor : 'border-zinc-200 text-zinc-400 hover:border-zinc-300'}`}
                  >
                    {label}
                  </button>
                )
                return (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 border border-zinc-100 group">
                    <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-zinc-700 truncate">{f.name}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {chip('notes', 'Notes', 'border-blue-400 bg-blue-100 text-blue-700', 'blue')}
                      {chip('pyq', 'PYQ', 'border-amber-400 bg-amber-100 text-amber-700', 'amber')}
                      {chip('other', 'Other', 'border-zinc-400 bg-zinc-200 text-zinc-600', 'zinc')}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextFiles = dialogFiles.filter((_, idx) => idx !== i)
                        const nextTypes = dialogFileTypes.filter((_, idx) => idx !== i)
                        setDialogFiles(nextFiles)
                        setDialogFileTypes(nextTypes)
                      }}
                      className="p-1 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-100 bg-zinc-50">
              <button
                onClick={() => { setShowUploadDialog(false); setDialogFiles([]); setDialogFileTypes([]) }}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-100 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#4a7c59] rounded-lg hover:bg-[#35583f] cursor-pointer transition-colors"
              >
                Upload {dialogFiles.length} file{dialogFiles.length > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {deletingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-5 py-6 flex flex-col items-center text-center gap-3">
              <div className={`p-3 rounded-full ${deletingLoading ? 'bg-zinc-100' : 'bg-red-50'}`}>
                {deletingLoading ? (
                  <div className="w-5 h-5 border-2 border-zinc-300 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5 text-red-500" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-800">
                  {deletingLoading ? 'Deleting...' : `Delete ${deletingItem.type}`}
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  {deletingLoading
                    ? 'Please wait while this item is being deleted.'
                    : `Are you sure you want to delete "${deletingItem.name}"? This action cannot be undone.`
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-zinc-50">
              {!deletingLoading && (
                <button
                  onClick={() => setDeletingItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-100 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={confirmDelete}
                disabled={deletingLoading}
                className="px-4 py-2 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors flex items-center gap-2 disabled:cursor-not-allowed bg-red-500 hover:bg-red-600 disabled:bg-zinc-300"
              >
                {deletingLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClassroomDetail
