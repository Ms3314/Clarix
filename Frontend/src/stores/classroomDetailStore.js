import { create } from 'zustand'
import api from '@/lib/api'

const STALE_MS = 5 * 60 * 1000

const useClassroomDetailStore = create((set, get) => ({
  _data: {},
  _meta: {},
  _fetching: {},
  _errors: {},

  getEntityData: (id, entity) => get()._data?.[id]?.[entity],

  getEntityError: (id, entity) => get()._errors[`${id}:${entity}`],

  getEntityLoading: (id, entity) => !!get()._fetching[`${id}:${entity}`],

  _ensureEntity: async (id, entity, fetcher, force = false, staleMs = STALE_MS) => {
    const metaKey = `${id}:${entity}`
    const { _fetching, _meta } = get()
    if (_fetching[metaKey]) return
    if (!force && _meta[metaKey] && Date.now() - _meta[metaKey] < staleMs) return

    set({ _fetching: { ..._fetching, [metaKey]: true }, _errors: { ...get()._errors, [metaKey]: null } })
    try {
      const data = await fetcher(id)
      set({
        _data: { ...get()._data, [id]: { ...(get()._data[id] || {}), [entity]: data } },
        _meta: { ...get()._meta, [metaKey]: Date.now() },
        _fetching: { ...get()._fetching, [metaKey]: false },
        _errors: { ...get()._errors, [metaKey]: null },
      })
      return data
    } catch (err) {
      set({
        _fetching: { ...get()._fetching, [metaKey]: false },
        _errors: { ...get()._errors, [metaKey]: err },
      })
      return null
    }
  },

  invalidateEntity: (id, entity) => {
    set({ _meta: { ...get()._meta, [`${id}:${entity}`]: null } })
  },

  fetchClassroom: (id, force) =>
    get()._ensureEntity(id, 'classroom', (id) => api.get(`/classrooms/${id}`).then(r => r.data), force),

  fetchStudents: (id, force) =>
    get()._ensureEntity(id, 'students', (id) => api.get(`/classrooms/${id}/students`).then(r => r.data.students || []), force),

  fetchResources: (id, force) =>
    get()._ensureEntity(id, 'resources', (id) => api.get(`/classrooms/${id}/resources`).then(r => r.data.resources || []), force),

  fetchQuizzes: (id, force) =>
    get()._ensureEntity(id, 'quizzes', (id) => api.get(`/classrooms/${id}/quizzes`).then(r => r.data.quizzes || []), force),

  fetchAnnouncements: (id, force) =>
    get()._ensureEntity(id, 'announcements', (id) => api.get(`/classrooms/${id}/announcements`).then(r => r.data.announcements || []), force),

  fetchFolders: (id, force) =>
    get()._ensureEntity(id, 'folders', (id) => api.get(`/classrooms/${id}/folders`).then(r => r.data.folders || []), force),

  fetchPending: (id, force) =>
    get()._ensureEntity(id, 'pending', (id) => api.get(`/classrooms/${id}/pending`).then(r => r.data.pending || []), force),

  setEntityData: (id, entity, data) => {
    set({
      _data: { ...get()._data, [id]: { ...(get()._data[id] || {}), [entity]: data } },
      _meta: { ...get()._meta, [`${id}:${entity}`]: Date.now() },
    })
  },

  fetchAll: async (id, force = false) => {
    const entities = ['classroom', 'students', 'resources', 'quizzes', 'announcements', 'folders']
    const toFetch = entities.filter(e => {
      const metaKey = `${id}:${e}`
      const meta = get()._meta[metaKey]
      const fetching = get()._fetching[metaKey]
      if (fetching) return false
      if (force) return true
      return !meta || Date.now() - meta >= STALE_MS
    })

    if (toFetch.length === 0) return

    const fetchers = {
      classroom: (id) => api.get(`/classrooms/${id}`).then(r => r.data),
      students: (id) => api.get(`/classrooms/${id}/students`).then(r => r.data.students || []),
      resources: (id) => api.get(`/classrooms/${id}/resources`).then(r => r.data.resources || []),
      quizzes: (id) => api.get(`/classrooms/${id}/quizzes`).then(r => r.data.quizzes || []),
      announcements: (id) => api.get(`/classrooms/${id}/announcements`).then(r => r.data.announcements || []),
      folders: (id) => api.get(`/classrooms/${id}/folders`).then(r => r.data.folders || []),
    }

    await Promise.all(toFetch.map(e => get()._ensureEntity(id, e, fetchers[e], force)))
  },
}))

export default useClassroomDetailStore
