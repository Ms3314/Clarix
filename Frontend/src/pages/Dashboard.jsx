import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Check, LogIn, FileText, Link, MoreVertical, GraduationCap, RefreshCw } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useSidebar } from '@/components/ui/sidebar'
import { Loading } from '@/components/ui/loading'
import ProfilePictureAvatar from '@/components/ProfilePictureAvatar'
import useAuthStore from '@/stores/authStore'
import useClassroomStore from '@/stores/classroomStore'

const Dashboard = () => {
  const user = useAuthStore((s) => s.user)
  const fetchUser = useAuthStore((s) => s.fetchUser)
  const { classrooms, fetchClassrooms, invalidate: invalidateClassrooms } = useClassroomStore()
  const [pageLoading, setPageLoading] = useState(true)
  const [copiedId, setCopiedId] = useState(null)
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [resources, setResources] = useState([])
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const navigate = useNavigate()
  const { setOpenMobile } = useSidebar()

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchUser(), fetchClassrooms()])
      setPageLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (user?.role === 'teacher') {
      fetchTeacherResources()
    }
  }, [user])

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

  const handleRefresh = async () => {
    setRefreshing(true)
    invalidateClassrooms()
    await Promise.all([fetchClassrooms(true), user?.role === 'teacher' ? fetchTeacherResources() : Promise.resolve()])
    setRefreshing(false)
  }

  const handleSelect = (cls) => {
    navigate(`/classroom/${cls.id}`)
    setOpenMobile(false)
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loading size="lg" />
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

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center justify-center w-8 h-8 rounded border border-[#e0dcd6] text-zinc-400 hover:bg-zinc-50 hover:border-zinc-400 hover:text-zinc-600 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {user?.role === 'teacher' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center w-8 h-8 rounded border border-[#e0dcd6] text-zinc-400 hover:bg-zinc-50 hover:border-zinc-400 hover:text-zinc-600 transition-all cursor-pointer">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px] p-1">
                <DropdownMenuItem
                  onClick={() => navigate('/classroom/new')}
                  className="text-xs gap-2 cursor-pointer rounded-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add New Classroom
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                        if (cls.banner_color) {
                          e.target.parentElement.style.background = cls.banner_color.startsWith('linear-gradient') ? cls.banner_color : `linear-gradient(135deg, ${cls.banner_color}, ${cls.banner_color}dd)`
                        } else {
                          e.target.parentElement.style.background = `linear-gradient(135deg, ${fallbackColor}, ${fallbackColor}dd)`
                        }
                      }}
                    />
                  ) : cls.banner_color ? (
                    <div
                      className="w-full h-full"
                      style={{ background: cls.banner_color.startsWith('linear-gradient') ? cls.banner_color : `linear-gradient(135deg, ${cls.banner_color}, ${cls.banner_color}dd)` }}
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

                {/* Teacher badge */}
                {user?.id === cls.teacher_id && (
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded bg-black/50 text-white text-[9px] font-semibold uppercase tracking-wider backdrop-blur-sm">
                    <GraduationCap className="w-3 h-3" />
                    Teacher
                  </div>
                )}

                {/* Bottom bar */}
                <div className="px-4 pb-3 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
                    {cls.student_count || 0} students
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-center w-7 h-7 rounded border border-[#e0dcd6] text-zinc-400 hover:bg-zinc-50 hover:border-zinc-400 hover:text-zinc-600 transition-all cursor-pointer"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[140px]">
                      <DropdownMenuItem
                        onClick={(e) => handleCopyLink(e, cls.id, cls.invite_code)}
                        className="text-xs gap-2 cursor-pointer"
                      >
                        {copiedId === cls.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Link className="w-3.5 h-3.5" />
                        )}
                        {copiedId === cls.id ? 'Copied!' : 'Copy Link'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
              <Loading size="sm" className="py-8" />
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
                    <div className="flex items-center gap-1.5">
                      {doc.resource_type && (
                        <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 border ${doc.resource_type === 'pyq' ? 'text-amber-600 border-amber-200 bg-amber-50' : doc.resource_type === 'notes' ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-zinc-500 border-zinc-200 bg-zinc-50'}`}>
                          {doc.resource_type === 'pyq' ? 'PYQ' : doc.resource_type === 'notes' ? 'Notes' : 'Other'}
                        </span>
                      )}
                      <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 border ${doc.indexed ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-amber-600 border-amber-200 bg-amber-50'}`}>
                        {doc.indexed ? 'Indexed' : 'Pending'}
                      </span>
                    </div>
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
