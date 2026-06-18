import { create } from 'zustand'
import api from '@/lib/api'

const STALE_MS = 2 * 60 * 1000

const useClassroomStore = create((set, get) => ({
  classrooms: [],
  isLoading: false,
  isFetching: false,
  lastFetched: null,

  fetchClassrooms: async (force = false) => {
    const { lastFetched, isFetching } = get()
    if (isFetching) return
    if (!force && lastFetched && Date.now() - lastFetched < STALE_MS) return
    set({ isLoading: true, isFetching: true })
    try {
      const res = await api.get('/classrooms/')
      set({ classrooms: res.data.classrooms || [], isLoading: false, isFetching: false, lastFetched: Date.now() })
    } catch {
      set({ isLoading: false, isFetching: false })
    }
  },

  invalidate: () => set({ lastFetched: null }),
}))

export default useClassroomStore
