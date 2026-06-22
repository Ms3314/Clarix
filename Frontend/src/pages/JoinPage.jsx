import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, Clock, LogIn, XCircle, Users, Globe, Lock, BookOpen, HelpCircle, Layers, Megaphone, GraduationCap } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'

const FEATURE_ICONS = {
  resources_enabled: { icon: BookOpen, label: 'Resources', color: 'text-emerald-600 bg-emerald-50' },
  quizzes_enabled: { icon: HelpCircle, label: 'Quizzes', color: 'text-teal-600 bg-teal-50' },
  flashcards_enabled: { icon: Layers, label: 'Flashcards', color: 'text-indigo-600 bg-indigo-50' },
  announcements_enabled: { icon: Megaphone, label: 'Announcements', color: 'text-amber-600 bg-amber-50' },
}

export default () => {
  const { code } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [classInfo, setClassInfo] = useState(null)
  const [joinState, setJoinState] = useState(null)
  const [joinMessage, setJoinMessage] = useState('')
  const [token, setToken] = useState(null)

  useEffect(() => {
    const t = localStorage.getItem('clarix_token')
    setToken(t)
    fetchClassInfo()
  }, [])

  const fetchClassInfo = async () => {
    try {
      const res = await api.get(`/classrooms/info/${code}`)
      setClassInfo(res.data)
    } catch (err) {
      toast.error('Invalid or expired invite link')
      setJoinState('error')
      setJoinMessage('This invite link is invalid or has expired.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    setJoinState('joining')
    try {
      const res = await api.post('/classrooms/join', { invite_code: code })
      setJoinMessage(res.data.message)
      setJoinState(res.data.status === 'approved' ? 'success' : 'pending')
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to join classroom'
      setJoinMessage(detail)
      if (err.response?.status === 401) {
        localStorage.removeItem('clarix_token')
        setToken(null)
        setJoinState(null)
      } else {
        setJoinState('error')
      }
      toast.error(detail)
    }
  }

  const handleLogin = () => {
    localStorage.setItem('join_redirect', code)
    navigate('/')
  }

  const colors = ['#4a7c59', '#7c4a4a', '#4a5f7c', '#7c6a4a', '#4a6b7c', '#6a4a7c']
  const fallbackColor = classInfo ? colors[classInfo.id % colors.length] : '#4a7c59'

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f6] flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      </div>
    )
  }

  if (joinState === 'success' || joinState === 'pending') {
    return (
      <div className="min-h-screen bg-[#faf8f6] flex items-center justify-center p-4 select-none">
        <div className="w-full max-w-md bg-white rounded-2xl border border-[#e8e4e0] shadow-sm p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center bg-[#f5f1ec]">
            {joinState === 'success' ? (
              <CheckCircle className="w-6 h-6 text-[#4a7c59]" />
            ) : (
              <Clock className="w-6 h-6 text-amber-500" />
            )}
          </div>
          <h1 className="text-xl font-bold text-zinc-900 mb-2">
            {joinState === 'success' ? 'Welcome!' : 'Request Sent'}
          </h1>
          <p className="text-sm text-zinc-500 mb-6">{joinMessage}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full px-6 py-2.5 text-sm font-semibold rounded-xl bg-[#4a7c59] text-white hover:bg-[#3d6b4c] transition-all cursor-pointer"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const showJoinButton = token && joinState !== 'error' && classInfo
  const showLoginButton = !token && joinState !== 'error' && classInfo

  const enabledFeatures = classInfo
    ? Object.entries(FEATURE_ICONS).filter(([key]) => classInfo[key]).map(([, v]) => v)
    : []

  return (
    <div className="min-h-screen bg-[#faf8f6] flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-xl bg-white rounded-2xl border border-[#e8e4e0] shadow-sm overflow-hidden">
        {/* Clarix Brand Header */}
        <div className="px-6 sm:px-8 pt-6 pb-4 flex items-center gap-2.5 border-b border-[#f0ece8]">
          <img src="/icon.png" className="w-7 h-7 object-contain" />
          <span className="font-bold text-sm tracking-tight text-[#4a4948]">Clarix</span>
        </div>

        {/* Banner */}
        <div className="h-40 sm:h-48 relative overflow-hidden bg-zinc-200">
          {classInfo?.banner ? (
            <img
              src={classInfo.banner}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.parentElement.style.background = `linear-gradient(135deg, ${fallbackColor}, ${fallbackColor}dd)`
              }}
            />
          ) : (
            <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${fallbackColor}, ${fallbackColor}dd)` }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />

          {/* Visibility badge on banner */}
          {classInfo && (
            <div className="absolute top-3 right-3">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg backdrop-blur-sm ${
                classInfo.is_public
                  ? 'text-white bg-white/20'
                  : 'text-amber-200 bg-amber-900/30'
              }`}>
                {classInfo.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {classInfo.is_public ? 'Public' : 'Private'}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        {classInfo ? (
          <div className="p-6 sm:p-8 space-y-6">
            {/* Title & Teacher */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 leading-tight mb-3">
                {classInfo.name}
              </h1>

              {/* Teacher info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-[#f0ece8] flex items-center justify-center shrink-0 border border-[#e8e4e0]">
                  {classInfo.teacher_profile_picture ? (
                    <img src={classInfo.teacher_profile_picture} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-[#4a7c59]">
                      {(classInfo.teacher_name || 'T').charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-800">
                    {classInfo.teacher_name || 'Teacher'}
                  </p>
                  <div className="flex items-center gap-1 text-[11px] text-amber-600 font-semibold">
                    <GraduationCap className="w-3 h-3" />
                    <span>Instructor</span>
                  </div>
                </div>
              </div>

              {/* Co-teachers */}
              {classInfo.co_teachers?.length > 0 && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#f0ece8]">
                  <span className="text-[11px] text-zinc-400 font-medium">Co-teachers:</span>
                  <div className="flex items-center gap-1.5">
                    {classInfo.co_teachers.map((ct) => (
                      <div key={ct.id} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-50 border border-zinc-100">
                        <div className="w-5 h-5 rounded-full bg-[#f0ece8] flex items-center justify-center overflow-hidden">
                          {ct.profile_picture_url ? (
                            <img src={ct.profile_picture_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[9px] font-bold text-zinc-500">{ct.username.charAt(0)}</span>
                          )}
                        </div>
                        <span className="text-[11px] font-medium text-zinc-600">{ct.username}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Subject + Students row */}
            <div className="flex flex-wrap items-center gap-3">
              {classInfo.subject && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                  <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
                  {classInfo.subject}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 bg-zinc-50 border border-zinc-100">
                <Users className="w-3.5 h-3.5" />
                {classInfo.student_count || 0} {classInfo.student_count === 1 ? 'student' : 'students'}
              </span>
            </div>

            {/* Description */}
            {classInfo.description && (
              <div className="bg-[#faf8f6] rounded-xl border border-[#f0ece8] p-4">
                <p className="text-sm text-zinc-600 leading-relaxed">
                  {classInfo.description}
                </p>
              </div>
            )}

            {/* Feature Flags */}
            {enabledFeatures.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-3">
                  Classroom Features
                </h4>
                <div className="flex flex-wrap gap-2">
                  {enabledFeatures.map(({ icon: Icon, label, color }) => (
                    <span
                      key={label}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${color} border-current/10`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Button */}
            <div className="pt-2">
              {joinState === 'joining' ? (
                <button
                  disabled
                  className="w-full px-6 py-3 text-sm font-semibold rounded-xl bg-zinc-200 text-zinc-400 flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Joining...
                </button>
              ) : showJoinButton ? (
                <button
                  onClick={handleJoin}
                  className="w-full px-6 py-3 text-sm font-semibold rounded-xl bg-[#4a7c59] text-white hover:bg-[#3d6b4c] transition-all cursor-pointer active:scale-[0.98]"
                >
                  Join Class
                </button>
              ) : showLoginButton ? (
                <button
                  onClick={handleLogin}
                  className="w-full px-6 py-3 text-sm font-semibold rounded-xl bg-[#4a7c59] text-white hover:bg-[#3d6b4c] transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In to Join
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-red-50">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">Invalid Link</h2>
            <p className="text-sm text-zinc-500 mb-6">This invite link is invalid or has expired.</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2.5 text-sm font-semibold rounded-xl bg-zinc-200 text-zinc-600 hover:bg-zinc-300 transition-all cursor-pointer"
            >
              Go Home
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
