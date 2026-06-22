import { create } from 'zustand'
import api from '@/lib/api'
import { resetAllStores } from '@/lib/resetStores'

const STALE_MS = 5 * 60 * 1000

const useAuthStore = create((set, get) => ({
  user: null,
  isLoading: false,
  isFetching: false,
  error: null,
  lastFetched: null,

  fetchUser: async (force = false) => {
    const { lastFetched, isFetching } = get()
    if (isFetching) return
    if (!force && lastFetched && Date.now() - lastFetched < STALE_MS) return
    set({ isLoading: true, isFetching: true, error: null })
    try {
      const res = await api.get('/auth/me')
      set({ user: res.data, isLoading: false, isFetching: false, lastFetched: Date.now() })
    } catch (err) {
      set({ error: err, isLoading: false, isFetching: false })
    }
  },

  setUser: (user) => set({ user, lastFetched: Date.now() }),

  logout: () => {
    localStorage.removeItem('clarix_token')
    resetAllStores()
  },

  hydrate: async () => {
    const token = localStorage.getItem('clarix_token')
    if (token) {
      await get().fetchUser()
    }
  },
}))

export default useAuthStore
