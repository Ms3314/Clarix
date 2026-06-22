import { create } from 'zustand'
import api from '@/lib/api'

const useLearnStore = create((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messagesBySession: {},
  isLoading: false,

  fetchSessions: async (classroomId) => {
    set({ isLoading: true })
    try {
      const res = await api.get(`/classrooms/${classroomId}/chat/sessions`)
      const sessions = (res.data.sessions || []).map(s => ({
        id: s.id,
        title: s.title || 'New Conversation',
        classroomId,
        message_count: s.message_count || 0,
      }))
      set({ sessions, isLoading: false })
      return sessions
    } catch {
      set({ isLoading: false })
      return []
    }
  },

  fetchMessages: async (sessionId, classroomId) => {
    try {
      const res = await api.get(`/classrooms/${classroomId}/chat/sessions/${sessionId}`)
      const msgs = (res.data.messages || []).map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.created_at ? new Date(m.created_at).toLocaleTimeString() : '',
      }))
      set({ messagesBySession: { ...get().messagesBySession, [sessionId]: msgs } })
      return msgs
    } catch {
      return []
    }
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  createSession: async (classroomId) => {
    try {
      const res = await api.post(`/classrooms/${classroomId}/chat/sessions`, {})
      const session = res.data.session
      set({
        sessions: [{
          id: session.id,
          title: session.title || 'New Conversation',
          classroomId,
        }, ...get().sessions],
        activeSessionId: session.id,
      })
      return session
    } catch {
      return null
    }
  },

  addMessage: (sessionId, message) => {
    const existing = get().messagesBySession[sessionId] || []
    set({ messagesBySession: { ...get().messagesBySession, [sessionId]: [...existing, message] } })
  },

  updateSessionTitle: (sessionId, title) => {
    set({ sessions: get().sessions.map(s => s.id === sessionId ? { ...s, title } : s) })
  },

  reset: () => set({
    sessions: [],
    activeSessionId: null,
    messagesBySession: {},
    isLoading: false,
  }),
}))

export default useLearnStore
