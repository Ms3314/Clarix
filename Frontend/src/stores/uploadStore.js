import { create } from 'zustand'
import api from '@/lib/api'
import { toast } from 'sonner'

let nextId = 1

const useUploadStore = create((set, get) => ({
  queue: [],
  isProcessing: false,
  currentIndex: 0,
  total: 0,
  successCount: 0,
  failCount: 0,

  addFiles: (files, fileTypes, classroomId, folderId) => {
    const items = files.map((f, i) => ({
      id: nextId++,
      file: f,
      type: fileTypes[i] || 'notes',
      name: f.name,
      classroomId,
      folderId: folderId || null,
      status: 'pending',
      error: null,
    }))

    set((state) => ({
      queue: [...state.queue, ...items],
      total: state.total + items.length,
    }))

    get().processNext()
  },

  processNext: async () => {
    const { isProcessing, queue } = get()
    if (isProcessing) return

    const nextItem = queue.find((q) => q.status === 'pending')
    if (!nextItem) {
      const { successCount, failCount, total } = get()
      if (total > 0) {
        if (failCount === 0) {
          toast.success(`All ${total} file(s) uploaded`)
        } else {
          toast.success(`${successCount} uploaded, ${failCount} failed`)
        }
        setTimeout(() => {
          const current = get()
          if (current.queue.every((q) => q.status === 'done' || q.status === 'error')) {
            set({ queue: [], isProcessing: false, currentIndex: 0, total: 0, successCount: 0, failCount: 0 })
          }
        }, 6000)
      }
      return
    }

    set({ isProcessing: true })

    set((state) => ({
      queue: state.queue.map((q) =>
        q.id === nextItem.id ? { ...q, status: 'uploading' } : q
      ),
      currentIndex: state.currentIndex + 1,
    }))

    try {
      const formData = new FormData()
      formData.append('file', nextItem.file)
      formData.append('resource_type', nextItem.type)
      if (nextItem.folderId) {
        formData.append('folder_id', String(nextItem.folderId))
      }

      await api.post(`/classrooms/${nextItem.classroomId}/resources/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      set((state) => ({
        queue: state.queue.map((q) =>
          q.id === nextItem.id ? { ...q, status: 'done' } : q
        ),
        successCount: state.successCount + 1,
      }))

      try {
        const { default: useClassroomDetailStore } = await import('./classroomDetailStore')
        const store = useClassroomDetailStore.getState()
        store.invalidateEntity(nextItem.classroomId, 'resources')
        store.invalidateEntity(nextItem.classroomId, 'folders')
        store.fetchResourcesStore(nextItem.classroomId, true)
        store.fetchFoldersStore(nextItem.classroomId, true)
      } catch {}
    } catch {
      set((state) => ({
        queue: state.queue.map((q) =>
          q.id === nextItem.id ? { ...q, status: 'error', error: 'Upload failed' } : q
        ),
        failCount: state.failCount + 1,
      }))
    }

    set({ isProcessing: false })
    get().processNext()
  },

  retryAll: () => {
    const failed = get().queue.filter((q) => q.status === 'error')
    if (failed.length === 0) return
    set((state) => ({
      queue: state.queue.map((q) =>
        q.status === 'error' ? { ...q, status: 'pending', error: null } : q
      ),
      successCount: state.successCount - failed.filter((q) => q.status === 'error').length,
      failCount: state.failCount - failed.length,
    }))
    get().processNext()
  },

  clearAll: () => {
    set({ queue: [], isProcessing: false, currentIndex: 0, total: 0, successCount: 0, failCount: 0 })
  },
}))

export default useUploadStore
