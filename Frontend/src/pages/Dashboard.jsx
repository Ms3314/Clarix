import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Check, LogIn, FileText, Link } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useSidebar } from '@/components/ui/sidebar'
import ProfilePictureAvatar from '@/components/ProfilePictureAvatar'

const Dashboard = () => {
  const [user, setUser] = useState(null)
  const [classrooms, setClassrooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState(null)
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [resources, setResources] = useState([])
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const navigate = useNavigate()
  const { setOpenMobile } = useSidebar()

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  useEffect(() => {
    fetchClassrooms()
  }, [])

  useEffect(() => {
    if (user?.role === 'teacher') {
      fetchTeacherResources()
    }
  }, [user])

  const fetchClassrooms = async () => {
    try {
      const userRes = await api.get('/auth/me')
      setUser(userRes.data)
      const res = await api.get('/classrooms/')
      setClassrooms(res.data.classrooms || [])
    } catch (error) {
      toast.error('Failed to load dashboard')
      if (error.response?.status === 401) navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const fetchTeacherResources = async () => {
    setResourcesLoading(true)
    try {
      const res = await api.get('/teacher/resources')
      setResources(res.data.resources || [])
    } catch {
      // silently fail
    } finally {
      setResourcesLoading(false)
    }
  }

  const handleJoinClassroom = async (e) => {
    e.preventDefault()
    if (!inviteCode.trim()) return
    setJoining(true)
    try {
      const res = await api.post('/classrooms/join', { invite_code: inviteCode.trim() })
      toast.success(res.data.message || 'Join request sent!')
      setInviteCode('')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to join classroom')
    } finally {
      setJoining(false)
    }
  }

  const handleCopyLink = (e, id, code) => {
    e.stopPropagation()
    const link = `${window.location.origin}/join/${code}`
    navigator.clipboard.writeText(link)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSelect = (cls) => {
    navigate(`/classroom/${cls.id}`)
    setOpenMobile(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 min-h-[60vh]">
        <div className="text-lg text-zinc-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-12 select-none">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between pb-6 border-b border-zinc-200 gap-4">
          <div>
            <h1 className="text-4xl lg:text-5xl font-serif  tracking-tight text-zinc-900">
              {getGreeting()}, {user?.username || 'there'}
            </h1>
          </div>

          {user?.role === 'teacher' && (
            <button
              onClick={() => navigate('/classroom/new')}
              className="flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-widest font-bold border transition-all cursor-pointer bg-[#1c1b1a] text-white border-zinc-900 hover:bg-[#faf7f3] hover:text-[#1c1b1a]"
            >
              <Plus className="w-4 h-4" />
              Add New Classroom
            </button>
          )}
        </div>

        {/* Join Classroom — Student */}
        {user?.role === 'student' && (
          <form onSubmit={handleJoinClassroom} className="flex items-center gap-3 p-4 border bg-white border-[#eae6e1]">
            <LogIn className="w-4 h-4 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Enter invite code..."
              className="flex-1 px-3 py-2 text-xs  border focus:outline-none bg-[#faf7f3] border-[#eae6e1] text-zinc-800 placeholder:text-zinc-400 uppercase tracking-wider"
              maxLength={10}
            />
            <button
              type="submit"
              disabled={joining || !inviteCode.trim()}
              className="px-4 py-2 text-xs uppercase tracking-widest font-bold border transition-all cursor-pointer bg-[#1c1b1a] text-white border-zinc-900 hover:bg-[#faf7f3] hover:text-[#1c1b1a] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {joining ? 'Joining...' : 'Join Classroom'}
            </button>
          </form>
        )}

        {/* Classrooms Grid */}
        {classrooms.length === 0 && (
          <div className="text-center py-16">
            <p className="text-zinc-400 text-sm">
              {user?.role === 'teacher'
                ? 'No classrooms created yet. Create your first classroom!'
                : 'No classrooms enrolled yet.'}
            </p>

          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classrooms.map((cls) => {
            const colors = ['#4a7c59', '#7c4a4a', '#4a5f7c', '#7c6a4a', '#4a6b7c', '#6a4a7c']
            const fallbackColor = colors[cls.id % colors.length]

            return (
              <div
                key={cls.id}
                onClick={() => handleSelect(cls)}
                className="group relative overflow-hidden rounded-lg border border-[#e0dcd6] transition-all duration-200 cursor-pointer bg-white hover:shadow-md hover:border-zinc-400"
              >
                {/* Banner */}
                <div className="h-28 sm:h-32 relative overflow-hidden bg-zinc-200">
                  {cls.banner ? (
                    <img
                      src={cls.banner}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.parentElement.style.background = `linear-gradient(135deg, ${fallbackColor}, ${fallbackColor}dd)`
                      }}
                    />
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{ background: `linear-gradient(135deg, ${fallbackColor}, ${fallbackColor}dd)` }}
                    />
                  )}
                  {/* Ref code on banner */}
                  
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="text-base font-semibold text-zinc-900 leading-tight mb-0.5 group-hover:underline">
                    {cls.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <ProfilePictureAvatar 
                      profilePictureUrl={cls.teacher_profile_picture}
                      username={cls.teacher_name}
                      size="sm"
                    />
                    <p className="text-xs text-zinc-500">
                      {cls.teacher_name || 'Teacher'}
                    </p>
                  </div>
                </div>

                {/* Bottom bar */}
                <div className="px-4 pb-3 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
                    {cls.student_count || 0} students
                  </span>
                  <button
                    onClick={(e) => handleCopyLink(e, cls.id, cls.invite_code)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded border border-[#e0dcd6] text-zinc-600 hover:bg-zinc-50 hover:border-zinc-400 transition-all cursor-pointer"
                    title="Copy Join Link"
                  >
                    {copiedId === cls.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Link className="w-3 h-3" />
                        Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Uploaded Documents - Teacher Only */}
        {user?.role === 'teacher' && (
          <div className="pt-4">
            <div className="flex items-center gap-2 mb-6">
              <FileText className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-600">
                Uploaded Documents
              </h2>
              {!resourcesLoading && (
                <span className="text-[10px] px-2 py-0.5 border bg-[#faf7f3] text-zinc-500">
                  {resources.length} total
                </span>
              )}
            </div>

            {resourcesLoading ? (
              <div className="text-sm text-zinc-400">Loading...</div>
            ) : resources.length === 0 ? (
              <div className="text-sm text-zinc-400 py-8 text-center border border-dashed border-[#eae6e1]">
                No documents uploaded yet. Upload PDFs in any classroom to see them here.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {resources.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-3 border bg-white border-[#eae6e1] hover:border-zinc-300 transition-colors"
                  >
                    <div className="p-2 border bg-[#faf7f3] border-[#eae6e1] shrink-0">
                      <FileText className="w-3.5 h-3.5 text-zinc-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-800 truncate">
                        {doc.filename}
                      </p>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5">
                        {doc.classroom_name}
                        {doc.file_size && ` · ${(doc.file_size / 1024).toFixed(0)} KB`}
                      </p>
                    </div>
                    <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 border ${doc.indexed ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-amber-600 border-amber-200 bg-amber-50'}`}>
                      {doc.indexed ? 'Indexed' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}

export default Dashboard
