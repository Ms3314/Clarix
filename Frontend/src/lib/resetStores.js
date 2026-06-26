import useAuthStore from '@/stores/authStore'
import useClassroomStore from '@/stores/classroomStore'
import useClassroomDetailStore from '@/stores/classroomDetailStore'
import useUploadStore from '@/stores/uploadStore'
import useLearnStore from '@/stores/learnStore'

export function resetAllStores() {
  useAuthStore.setState({ user: null, isLoading: false, isFetching: false, error: null, lastFetched: null })
  useAuthStore.persist.clearStorage()
  useClassroomStore.setState({ classrooms: [], isLoading: false, isFetching: false, lastFetched: null })
  useClassroomStore.persist.clearStorage()
  useClassroomDetailStore.setState({ _data: {}, _meta: {}, _fetching: {}, _errors: {} })
  useClassroomDetailStore.persist.clearStorage()
  useUploadStore.setState({ queue: [], isProcessing: false, currentIndex: 0, total: 0, successCount: 0, failCount: 0 })
  useLearnStore.setState({ sessions: [], activeSessionId: null, messagesBySession: {}, isLoading: false })
}
