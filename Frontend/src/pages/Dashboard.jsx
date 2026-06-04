import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Sigma, FlaskConical, Scroll, Clipboard, Check, LogIn } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useSidebar } from '@/components/ui/sidebar'
import { CreateClassroomModal } from '@/components/classroom'

const iconMap = {
  sigma: Sigma,
  flask: FlaskConical,
  scroll: Scroll,
}

const Dashboard = () => {
  const [user, setUser] = useState(null)
  const [classrooms, setClassrooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const navigate = useNavigate()
  const { setOpenMobile } = useSidebar()

  useEffect(() => {
    fetchClassrooms()
  }, [])

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

  const handleCreateClassroom = async (data) => {
    try {
      await api.post('/classrooms/', data)
      toast.success('Classroom created successfully!')
      setShowCreateModal(false)
      fetchClassrooms()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create classroom')
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

  const handleCopyCode = (e, id, code) => {
    e.stopPropagation()
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSelect = (cls) => {
    navigate(`/classroom/${cls.id}`)
    setOpenMobile(false)
  }

  const getIcon = (iconName) => {
    const Icon = iconMap[iconName] || Sigma
    return <Icon className="w-4 h-4" />
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
          <div className="flex items-start gap-4">
            <div>
              <span className="text-[10px] font-bold  tracking-[0.2em] text-[#b45309] uppercase block mb-1">
                Academic Index
              </span>
              <h1 className="text-4xl lg:text-5xl font-serif italic tracking-tight text-zinc-900">
                {user?.role === 'teacher' ? 'My Classrooms' : 'Enrolled Classrooms'}
              </h1>
              <p className="text-xs mt-3 max-w-xl font-sans leading-relaxed text-zinc-500">
                {user?.role === 'teacher'
                  ? 'Select an academic folio workspace to initiate secure interactive review loops with the AI context-engine.'
                  : 'Browse your enrolled classrooms and start learning.'}
              </p>
            </div>
          </div>

          {user?.role === 'teacher' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-widest font-bold border transition-all cursor-pointer bg-[#1c1b1a] text-white border-zinc-900 hover:bg-[#faf7f3] hover:text-[#1c1b1a]"
            >
              <Plus className="w-4 h-4" />
              New Archive
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
            {user?.role === 'teacher' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-5 py-3 bg-[#1c1b1a] text-white text-xs uppercase tracking-widest font-bold border border-zinc-900 cursor-pointer hover:bg-[#faf7f3] hover:text-[#1c1b1a] transition-all"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Create Classroom
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {classrooms.map((cls) => (
            <div
              key={cls.id}
              onClick={() => handleSelect(cls)}
              className="group relative border p-6 flex flex-col justify-between h-[230px] transition-all duration-300 cursor-pointer bg-white border-[#eae6e1] hover:border-zinc-900 hover:shadow-[0_4px_25px_rgba(28,27,26,0.04)]"
            >
              <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r transition-colors duration-300 border-zinc-200 group-hover:border-zinc-900" />

              <div className="flex items-center justify-between">
                <div className="p-2 border bg-[#faf7f3] border-[#eae6e1]">
                  {getIcon(cls.icon || 'sigma')}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-amber-500" />
                  <span className="text-[9px]  uppercase tracking-wider text-zinc-400">
                    Active
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <span className="text-[9px]  tracking-widest text-[#b45309] uppercase block mb-1">
                  Ref. Code: {(cls.invite_code || '').split('-')[0] || 'ACAD'}
                </span>
                <h3 className="text-xl font-serif font-semibold italic tracking-tight leading-tight group-hover:underline decoration-amber-500/50 decoration-1 text-zinc-900">
                  {cls.name}
                </h3>
              </div>

              <div className="space-y-2 pt-4 border-t border-[#eae6e1]/75">
                <div className="flex items-center justify-between text-xs ">
                  <span className="uppercase tracking-wider text-[9px] text-zinc-400">Enrolled</span>
                  <span className="px-2 py-0.5 font-bold  border text-[10px] bg-[#faf7f3] border-zinc-150 text-zinc-800">
                    {cls.student_count || 0} students
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs ">
                  <span className="uppercase tracking-wider text-[9px] text-zinc-400">Code</span>
                  <button
                    onClick={(e) => handleCopyCode(e, cls.id, cls.invite_code)}
                    className="flex items-center gap-2 px-2 py-1 border font-medium cursor-pointer transition-all bg-[#faf7f3] hover:bg-white border-zinc-250 text-zinc-800"
                    title="Copy Invite Code"
                  >
                    <span className=" text-[11px] tracking-wider">{cls.invite_code}</span>
                    {copiedId === cls.id ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Clipboard className="w-3 h-3 opacity-60" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {user?.role === 'teacher' && (
            <div
              onClick={() => setShowCreateModal(true)}
              className="border border-dashed p-6 flex flex-col justify-center items-center h-[230px] cursor-pointer transition-all duration-300 select-none group border-[#eae6e1] hover:border-zinc-900 bg-transparent hover:bg-white text-zinc-500"
            >
              <div className="p-3.5 mb-3 transition-all duration-300 group-hover:scale-105 border bg-[#faf7f3] text-zinc-800 border-[#eae6e1]">
                <Plus className="w-4 h-4" />
              </div>
              <p className="font-serif font-semibold italic text-base tracking-tight mb-0.5">Catalog New Folio</p>
              <span className="text-[9px] uppercase  tracking-widest opacity-60">Initialize syllabus</span>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateClassroomModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateClassroom}
        />
      )}
    </div>
  )
}

export default Dashboard
