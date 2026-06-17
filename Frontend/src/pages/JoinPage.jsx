import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, Clock, LogIn, XCircle, Users, Globe, Lock } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'

export default () => {
  const { code } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [classInfo, setClassInfo] = useState(null)
  const [joinState, setJoinState] = useState(null) // null | 'joining' | 'success' | 'pending' | 'error'
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

  return (
    <div className="min-h-screen bg-[#faf8f6] flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-[#e8e4e0] shadow-sm overflow-hidden">
        {/* Banner */}
        <div className="h-36 sm:h-44 relative overflow-hidden bg-zinc-200">
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        {/* Content */}
        {classInfo ? (
          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-zinc-900 leading-tight mb-1">
                  {classInfo.name}
                </h1>
                <p className="text-sm text-zinc-500">
                  {classInfo.teacher_name || 'Teacher'}
                </p>
                {classInfo.subject && (
                  <p className="text-xs text-zinc-400 mt-1">{classInfo.subject}</p>
                )}
              </div>
              <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${classInfo.is_public ? 'text-[#4a7c59] bg-[#4a7c59]/10' : 'text-amber-600 bg-amber-50'}`}>
                {classInfo.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {classInfo.is_public ? 'Public' : 'Private'}
              </span>
            </div>

            {classInfo.description && (
              <p className="text-sm text-zinc-600 mb-6 leading-relaxed">
                {classInfo.description}
              </p>
            )}

            <div className="flex items-center gap-2 text-xs text-zinc-400 mb-6">
              <Users className="w-3.5 h-3.5" />
              <span>{classInfo.student_count || 0} students enrolled</span>
            </div>

            {joinState === 'joining' ? (
              <button
                disabled
                className="w-full px-6 py-3 text-sm font-semibold rounded-xl bg-zinc-200 text-zinc-400 flex items-center justify-center gap-2"
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
                className="w-full px-6 py-3 text-sm font-semibold rounded-xl bg-[#4a7c59] text-white hover:bg-[#3d6b4c] transition-all cursor-pointer"
              >
                Join Class
              </button>
            ) : showLoginButton ? (
              <button
                onClick={handleLogin}
                className="w-full px-6 py-3 text-sm font-semibold rounded-xl bg-[#4a7c59] text-white hover:bg-[#3d6b4c] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                Sign In to Join
              </button>
            ) : joinState === 'error' ? (
              <button
                onClick={() => navigate('/')}
                className="w-full px-6 py-3 text-sm font-semibold rounded-xl bg-zinc-200 text-zinc-600 hover:bg-zinc-300 transition-all cursor-pointer"
              >
                Go Home
              </button>
            ) : null}
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
