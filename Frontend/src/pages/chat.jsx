import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Send, Users,
  Wifi, WifiOff, Megaphone, Search, BookOpen
} from 'lucide-react'
import api from '@/lib/api'

// ── Set this to your app navbar height ───────────────────────────────────────
const NAVBAR_H = 64

const getToken = () =>
  localStorage.getItem('clarix_token') ||
  sessionStorage.getItem('clarix_token') ||
  localStorage.getItem('token') ||
  sessionStorage.getItem('token') ||
  ''

const INITIAL_RECONNECT_DELAY_MS = 1000
const MAX_RECONNECT_DELAY_MS = 10000
const MAX_PENDING_MESSAGES = 50
const NON_RETRYABLE_CLOSE_CODES = new Set([1002, 1003, 1008])

const createClientMessageId = () =>
  window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`

const getWebSocketUrl = (classroomId, token) => {
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ||
    api.defaults.baseURL ||
    'http://localhost:8000'

  const url = new URL(apiBaseUrl, window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `/chat/ws/${classroomId}/${encodeURIComponent(token)}`
  url.search = ''
  url.hash = ''

  return url.toString()
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtTime = (ts) =>
  ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''

const COLORS = ['#4a7c59','#b45309','#7c3aed','#0369a1','#be185d','#0f766e']
const nameColor = (name = '') => COLORS[name.charCodeAt(0) % COLORS.length]

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ name = '?', role, size = 36 }) => {
  const isTeacher = role === 'teacher'
  const bg = isTeacher ? '#fef3c7' : `${nameColor(name)}18`
  const fg = isTeacher ? '#92400e' : nameColor(name)
  const border = isTeacher ? '#fde68a' : `${nameColor(name)}44`
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: Math.round(size * 0.38),
      background: bg, color: fg, border: `1.5px solid ${border}`,
      userSelect: 'none',
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

// ─── Date divider ─────────────────────────────────────────────────────────────
const DateDivider = ({ ts }) => {
  const label = (() => {
    if (!ts) return ''
    const d = new Date(ts), now = new Date()
    const diff = Math.floor((now - d) / 86400000)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
  })()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
      <div style={{ flex: 1, height: 1, background: '#eae6e1' }} />
      <span style={{
        fontSize: 10, color: '#a1a1aa', fontWeight: 600,
        letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: '#eae6e1' }} />
    </div>
  )
}

// ─── Single message ───────────────────────────────────────────────────────────
const Bubble = ({ msg, isOwn, showAvatar, showName }) => {
  if (msg.type === 'system') return (
    <div style={{ textAlign: 'center', padding: '2px 0' }}>
      <span style={{
        fontSize: 11, color: '#a1a1aa', background: '#f4f4f5',
        padding: '3px 12px', borderRadius: 99,
      }}>{msg.message}</span>
    </div>
  )
  if (msg.type === 'join' || msg.type === 'leave') return (
    <div style={{ textAlign: 'center', padding: '1px 0' }}>
      <span style={{ fontSize: 11, color: '#c4c4c7' }}>
        {msg.sender} {msg.type === 'join' ? 'joined' : 'left'}
      </span>
    </div>
  )

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 8,
      flexDirection: isOwn ? 'row-reverse' : 'row',
      paddingLeft: isOwn ? 0 : (showAvatar ? 0 : 44),
    }}>
      {!isOwn && showAvatar && <Avatar name={msg.sender} role={msg.role} size={34} />}

      <div style={{
        maxWidth: '60%',
        display: 'flex', flexDirection: 'column',
        alignItems: isOwn ? 'flex-end' : 'flex-start',
        gap: 3,
      }}>
        {!isOwn && showName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 2 }}>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: nameColor(msg.sender),
            }}>{msg.sender}</span>
            {msg.role === 'teacher' && (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
                textTransform: 'uppercase', background: '#fef3c7',
                color: '#92400e', padding: '1px 5px', borderRadius: 3,
              }}>Instructor</span>
            )}
          </div>
        )}

        <div style={{
          padding: '9px 13px',
          borderRadius: isOwn
            ? '16px 4px 16px 16px'
            : '4px 16px 16px 16px',
          fontSize: 14, lineHeight: 1.5,
          background: isOwn ? '#1c1b1a' : '#ffffff',
          color: isOwn ? '#fafaf9' : '#1c1b1a',
          border: isOwn ? 'none' : '1px solid #eae6e1',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          wordBreak: 'break-word', whiteSpace: 'pre-wrap',
        }}>{msg.message}</div>

        <span style={{ fontSize: 10, color: '#b4b4b8', paddingRight: 2 }}>
          {fmtTime(msg.timestamp)}
        </span>
      </div>
    </div>
  )
}

// ─── Sidebar room row ─────────────────────────────────────────────────────────
const RoomRow = ({ room, active, onClick }) => (
  <button onClick={onClick} style={{
    width: '100%', textAlign: 'left', padding: '12px 16px',
    border: 'none', borderRadius: 0, cursor: 'pointer',
    background: active ? '#f0fdf4' : 'transparent',
    borderLeft: `3px solid ${active ? '#4a7c59' : 'transparent'}`,
    borderBottom: '1px solid #f5f3f0',
    transition: 'background 0.12s',
    display: 'flex', alignItems: 'center', gap: 12,
  }}>
    {/* Icon */}
    <div style={{
      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
      background: active ? '#dcfce7' : '#f4f4f5',
      border: `1px solid ${active ? '#a7f3d0' : '#e4e4e7'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia, serif', fontStyle: 'italic',
      fontWeight: 700, fontSize: 18,
      color: active ? '#166534' : '#71717a',
    }}>
      {room.classroom_name.charAt(0).toUpperCase()}
    </div>

    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: 13, fontWeight: active ? 700 : 600,
          color: active ? '#1c1b1a' : '#3f3f46',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{room.classroom_name}</span>
        {room.online_count > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, marginLeft: 6,
            background: '#dcfce7', color: '#166534',
            padding: '1px 7px', borderRadius: 99, flexShrink: 0,
          }}>{room.online_count}</span>
        )}
      </div>
      <span style={{
        fontSize: 11, color: '#a1a1aa', display: 'block',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2,
      }}>
        {room.last_message
          ? `${room.last_message.sender}: ${room.last_message.message}`
          : <i>No messages yet</i>}
      </span>
    </div>
  </button>
)

// ─── Group messages by date + collapse consecutive from same sender ───────────
function groupMessages(msgs) {
  const out = []
  let lastDate = null
  let lastSender = null

  for (const msg of msgs) {
    const dateKey = msg.timestamp ? new Date(msg.timestamp).toDateString() : null
    if (dateKey && dateKey !== lastDate) {
      out.push({ type: '__date__', ts: msg.timestamp })
      lastDate = dateKey
      lastSender = null
    }
    const showAvatar = msg.sender !== lastSender
    out.push({ ...msg, showAvatar, showName: showAvatar })
    if (msg.type === 'message') lastSender = msg.sender
  }
  return out
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const navigate = useNavigate()
  const [user, setUser]           = useState(null)
  const [rooms, setRooms]         = useState([])
  const [activeRoom, setActive]   = useState(null)
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [connectionState, setConnectionState] = useState('disconnected')
  const [online, setOnline]       = useState(0)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')

  const wsRef     = useRef(null)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)
  const activeRoomRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const reconnectAttemptRef = useRef(0)
  const pendingMessagesRef = useRef([])
  const manualCloseRef = useRef(false)
  const connectionSeqRef = useRef(0)
  const connectRef = useRef(null)

  // Load user + rooms
  useEffect(() => {
    ;(async () => {
      try {
        const [u, r] = await Promise.all([api.get('/auth/me'), api.get('/chat/rooms')])
        setUser(u.data)
        setRooms(r.data.rooms || [])
      } catch (e) {
        if (e.response?.status === 401) navigate('/')
      } finally { setLoading(false) }
    })()
  }, [navigate])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const queuePendingMessage = useCallback((payload) => {
    pendingMessagesRef.current = [
      ...pendingMessagesRef.current,
      payload,
    ].slice(-MAX_PENDING_MESSAGES)
  }, [])

  const flushPendingMessages = useCallback((socket) => {
    if (!socket || socket.readyState !== WebSocket.OPEN || pendingMessagesRef.current.length === 0) {
      return
    }

    const queued = [...pendingMessagesRef.current]
    pendingMessagesRef.current = []

    for (let i = 0; i < queued.length; i += 1) {
      const payload = queued[i]
      try {
        socket.send(JSON.stringify(payload))
      } catch (error) {
        console.error('Failed to flush queued chat message', error)
        pendingMessagesRef.current = [...queued.slice(i), ...pendingMessagesRef.current].slice(-MAX_PENDING_MESSAGES)
        setConnectionState('reconnecting')
        try {
          socket.close()
        } catch {
          // Ignore close failures after a send error.
        }
        return
      }
    }
  }, [])

  const scheduleReconnect = useCallback((room, reason = 'socket closed') => {
    if (!room || manualCloseRef.current) return

    clearReconnectTimer()

    const attempt = reconnectAttemptRef.current + 1
    reconnectAttemptRef.current = attempt
    const delay = Math.min(INITIAL_RECONNECT_DELAY_MS * (2 ** (attempt - 1)), MAX_RECONNECT_DELAY_MS)

    console.warn('Scheduling chat reconnect', {
      classroomId: room.classroom_id,
      attempt,
      delay,
      reason,
    })

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null
      if (!manualCloseRef.current && activeRoomRef.current?.classroom_id === room.classroom_id) {
        connectRef.current?.(room, { isReconnect: true })
      }
    }, delay)
  }, [clearReconnectTimer])

  // Connect WS
  const connect = useCallback((room, { isReconnect = false } = {}) => {
    if (!room) return

    const token = getToken()
    if (!token) {
      console.error('Cannot open chat WebSocket without an auth token')
      setConnectionState('disconnected')
      return
    }

    activeRoomRef.current = room
    setActive(room)
    setOnline(room.online_count || 0)

    if (!isReconnect) {
      setMessages([])
      reconnectAttemptRef.current = 0
      clearReconnectTimer()
    }

    const previousSocket = wsRef.current
    if (previousSocket) {
      previousSocket.onopen = null
      previousSocket.onclose = null
      previousSocket.onerror = null
      previousSocket.onmessage = null
      try {
        previousSocket.close(1000, 'Opening a new room connection')
      } catch {
        // Ignore close failures when replacing a socket.
      }
    }

    const connectionSeq = connectionSeqRef.current + 1
    connectionSeqRef.current = connectionSeq
    setConnectionState(isReconnect ? 'reconnecting' : 'connecting')

    let ws
    try {
      ws = new WebSocket(getWebSocketUrl(room.classroom_id, token))
    } catch (error) {
      console.error('Failed to create chat WebSocket', error)
      setConnectionState('reconnecting')
      scheduleReconnect(room, error?.message || 'failed to create WebSocket')
      return
    }

    wsRef.current = ws

    ws.onopen = () => {
      if (connectionSeqRef.current !== connectionSeq || wsRef.current !== ws) return
      reconnectAttemptRef.current = 0
      setConnectionState('connected')
      flushPendingMessages(ws)
    }

    ws.onclose = (event) => {
      if (connectionSeqRef.current !== connectionSeq) return
      if (wsRef.current === ws) {
        wsRef.current = null
      }
      if (manualCloseRef.current) {
        setConnectionState('disconnected')
        return
      }

      console.warn('Chat WebSocket closed', {
        classroomId: room.classroom_id,
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      })

      if (NON_RETRYABLE_CLOSE_CODES.has(event.code)) {
        clearReconnectTimer()
        setConnectionState('disconnected')
        console.error('Chat WebSocket closed with a non-retryable code', {
          classroomId: room.classroom_id,
          code: event.code,
          reason: event.reason,
        })
        return
      }

      setConnectionState('reconnecting')
      scheduleReconnect(room, event.reason || `close code ${event.code}`)
    }

    ws.onerror = (event) => {
      if (connectionSeqRef.current !== connectionSeq) return
      console.error('Chat WebSocket error', event)
    }

    ws.onmessage = ({ data }) => {
      if (connectionSeqRef.current !== connectionSeq) return

      try {
        const d = JSON.parse(data)

        if (d.type === 'history') {
          setMessages(d.messages || [])
          return
        }

        if (d.type === 'online_count') {
          setOnline(Number(d.count) || 0)
          return
        }

        if (d.type === 'message_deleted') {
          setMessages((prev) => prev.filter((msg) => msg.id !== d.message_id))
          return
        }

        if (d.type === 'message_pinned' || d.type === 'message_unpinned') {
          setMessages((prev) => prev.map((msg) => (
            msg.id === d.message_id
              ? { ...msg, is_pinned: d.type === 'message_pinned' }
              : msg
          )))
          return
        }

        if (d.type === 'message') {
          setMessages((prev) => (
            prev.some((msg) => msg.id === d.id) ? prev : [...prev, d]
          ))
          return
        }

        if (d.type === 'join' || d.type === 'leave' || d.type === 'system') {
          setMessages((prev) => [...prev, d])
        }
      } catch (error) {
        console.error('Failed to parse chat WebSocket message', error, data)
      }
    }
  }, [clearReconnectTimer, flushPendingMessages, scheduleReconnect])

  connectRef.current = connect

  useEffect(() => {
    const handleOnline = () => {
      if (!activeRoomRef.current || wsRef.current?.readyState === WebSocket.OPEN) return
      reconnectAttemptRef.current = 0
      clearReconnectTimer()
      connectRef.current?.(activeRoomRef.current, { isReconnect: true })
    }

    const handleOffline = () => {
      if (activeRoomRef.current) {
        setConnectionState('reconnecting')
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [clearReconnectTimer])

  useEffect(() => () => {
    manualCloseRef.current = true
    clearReconnectTimer()
    const socket = wsRef.current
    if (socket) {
      socket.onopen = null
      socket.onclose = null
      socket.onerror = null
      socket.onmessage = null
      try {
        socket.close(1000, 'Chat page unmounted')
      } catch {
        // Ignore close failures during cleanup.
      }
    }
  }, [clearReconnectTimer])

  const send = (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || !activeRoomRef.current) return

    const payload = {
      message: text,
      client_message_id: createClientMessageId(),
    }
    const socket = wsRef.current

    if (socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(payload))
      } catch (error) {
        console.error('Failed to send chat message, queueing for retry', error)
        queuePendingMessage(payload)
        setConnectionState('reconnecting')
        try {
          socket.close()
        } catch {
          // Ignore close failures after send errors.
        }
      }
    } else {
      console.warn('Chat socket is not open, queueing message until reconnect')
      queuePendingMessage(payload)
      setConnectionState('reconnecting')
      scheduleReconnect(activeRoomRef.current, 'message queued while disconnected')
    }

    setInput('')
    inputRef.current?.focus()
  }

  const filtered = rooms.filter(r =>
    r.classroom_name.toLowerCase().includes(search.toLowerCase())
  )
  const grouped = groupMessages(messages)
  const connected = connectionState === 'connected'
  const connectionLabel =
    connectionState === 'connected'
      ? 'Live'
      : connectionState === 'connecting'
        ? 'Connecting'
        : connectionState === 'reconnecting'
          ? 'Reconnecting'
          : 'Disconnected'
  const messagePlaceholder =
    connectionState === 'connected'
      ? `Message ${activeRoom?.classroom_name}…`
      : connectionState === 'reconnecting'
        ? 'Reconnecting… messages queue automatically'
        : 'Connecting…'

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:`calc(100vh - ${NAVBAR_H}px)` }}>
      <span style={{ color:'#a1a1aa', fontSize:14 }}>Loading…</span>
    </div>
  )

  // Full-viewport, no outer padding, no maxWidth
  return (
    <div style={{
      display: 'flex',
      height: `calc(100vh - ${NAVBAR_H}px)`,
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>

      {/* ══════════════ SIDEBAR ══════════════ */}
      <div style={{
        width: 300, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        background: '#fdfaf7',
        borderRight: '1px solid #eae6e1',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid #eae6e1',
          background: '#fdfaf7',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <button onClick={() => navigate('/dashboard')} style={{
              padding: '7px', border: '1px solid #eae6e1',
              background: 'transparent', cursor: 'pointer',
              borderRadius: 8, display:'flex', alignItems:'center',
              flexShrink: 0,
            }}>
              <ArrowLeft size={15} color="#52525b" />
            </button>
            <div>
              <span style={{
                fontSize: 9, letterSpacing: '0.12em', color: '#b45309',
                textTransform: 'uppercase', display: 'block', marginBottom: 2,
              }}>Workspace / Group Chats</span>
              <h2 style={{
                margin: 0, fontSize: 19,
                fontFamily: 'Georgia, serif', fontStyle: 'italic',
                fontWeight: 600, color: '#1c1b1a', lineHeight: 1,
              }}>Discussions</h2>
            </div>
          </div>

          {/* Search */}
          <div style={{ position:'relative' }}>
            <Search size={13} color="#a1a1aa" style={{
              position:'absolute', left:10, top:'50%',
              transform:'translateY(-50%)', pointerEvents:'none',
            }}/>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search classes…"
              style={{
                width:'100%', padding:'8px 10px 8px 30px',
                fontSize:12, border:'1px solid #eae6e1', borderRadius:8,
                outline:'none', background:'#fff', color:'#1c1b1a', boxSizing:'border-box',
              }}
            />
          </div>
        </div>

        {/* Rooms */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {filtered.length === 0
            ? <p style={{ fontSize:12, color:'#a1a1aa', padding:'20px 16px' }}>
                {rooms.length === 0 ? 'No classrooms yet.' : 'No results.'}
              </p>
            : filtered.map(r => (
                <RoomRow
                  key={r.classroom_id} room={r}
                  active={activeRoom?.classroom_id === r.classroom_id}
                  onClick={() => connect(r)}
                />
              ))
          }
        </div>
      </div>

      {/* ══════════════ MAIN CHAT ══════════════ */}
      {!activeRoom ? (
        // Empty state
        <div style={{
          flex:1, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:14,
          background: '#faf9f7',
        }}>
          <div style={{
            width:72, height:72, borderRadius:'50%',
            background:'#f0fdf4', border:'1px solid #a7f3d0',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <BookOpen size={30} color="#4a7c59" />
          </div>
          <p style={{
            fontFamily:'Georgia, serif', fontStyle:'italic',
            fontSize:21, color:'#52525b', margin:0,
          }}>Select a class to chat</p>
          <p style={{ fontSize:13, color:'#a1a1aa', margin:0 }}>
            Pick a room from the left panel
          </p>
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>

          {/* Chat header */}
          <div style={{
            padding:'12px 24px',
            background:'#ffffff', borderBottom:'1px solid #eae6e1',
            display:'flex', alignItems:'center', justifyContent:'space-between',
            flexShrink:0,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{
                width:42, height:42, borderRadius:12,
                background:'#dcfce7', border:'1px solid #a7f3d0',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'Georgia, serif', fontStyle:'italic',
                fontWeight:700, fontSize:18, color:'#166534',
              }}>
                {activeRoom.classroom_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{
                  margin:0, fontSize:16,
                  fontFamily:'Georgia, serif', fontStyle:'italic',
                  fontWeight:600, color:'#1c1b1a', lineHeight:1.2,
                }}>{activeRoom.classroom_name}</p>
                <span style={{ fontSize:11, color:'#a1a1aa' }}>
                  Instructor: {activeRoom.teacher_name}
                </span>
              </div>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <Users size={13} color="#a1a1aa" />
                <span style={{ fontSize:12, color:'#71717a' }}>{online} online</span>
              </div>
              <div style={{
                display:'flex', alignItems:'center', gap:5,
                padding:'4px 10px', borderRadius:99,
                background: connected ? '#f0fdf4' : '#fef2f2',
                border:`1px solid ${connected ? '#a7f3d0' : '#fecaca'}`,
              }}>
                {connected
                  ? <Wifi size={11} color="#4a7c59"/>
                  : <WifiOff size={11} color="#ef4444"/>}
                <span style={{
                  fontSize:10, fontWeight:700, letterSpacing:'0.07em',
                  textTransform:'uppercase',
                  color: connected ? '#166534' : '#ef4444',
                }}>
                  {connectionLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex:1, overflowY:'auto',
            padding:'24px 28px',
            display:'flex', flexDirection:'column', gap:6,
            background:'#faf9f7',
          }}>
            {messages.length === 0 ? (
              <div style={{
                flex:1, display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', gap:12,
              }}>
                <div style={{
                  width:56, height:56, borderRadius:'50%',
                  background:'#f0fdf4', border:'1px solid #a7f3d0',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  <Megaphone size={24} color="#4a7c59"/>
                </div>
                <p style={{
                  fontFamily:'Georgia, serif', fontStyle:'italic',
                  fontSize:17, color:'#71717a', margin:0,
                }}>No messages yet</p>
                <p style={{ fontSize:13, color:'#a1a1aa', margin:0 }}>
                  Be the first to start the discussion!
                </p>
              </div>
            ) : grouped.map((msg, i) =>
                msg.type === '__date__'
                  ? <DateDivider key={`d-${i}`} ts={msg.ts} />
                  : <Bubble
                      key={i}
                      msg={msg}
                      isOwn={msg.sender_id === user?.id}
                      showAvatar={msg.showAvatar}
                      showName={msg.showName}
                    />
              )
            }
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={send} style={{
            padding:'12px 24px',
            background:'#ffffff', borderTop:'1px solid #eae6e1',
            display:'flex', alignItems:'center', gap:10, flexShrink:0,
          }}>
            {user && (
              <Avatar name={user.username || user.email || '?'} role={user.role} size={36} />
            )}
            <input
              ref={inputRef}
              type="text" value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={messagePlaceholder}
              style={{
                flex:1, padding:'11px 18px', fontSize:14,
                border:'1px solid #eae6e1', borderRadius:24,
                outline:'none',
                background: connected ? '#fdfaf7' : '#f4f4f5',
                color:'#1c1b1a', transition:'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = '#4a7c59')}
              onBlur={e  => (e.target.style.borderColor = '#eae6e1')}
            />
            <button type="submit"
              disabled={!activeRoom || !input.trim()}
              style={{
                width:44, height:44, borderRadius:'50%',
                background: input.trim() ? '#1c1b1a' : '#e4e4e7',
                color: input.trim() ? '#ffffff' : '#a1a1aa',
                border:'none', flexShrink:0,
                cursor: input.trim() ? 'pointer' : 'default',
                display:'flex', alignItems:'center', justifyContent:'center',
                transition:'background 0.15s',
              }}
            >
              <Send size={16}/>
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
