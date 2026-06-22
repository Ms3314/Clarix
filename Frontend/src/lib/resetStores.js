import useAuthStore from '@/stores/authStore'
import useClassroomStore from '@/stores/classroomStore'
import useClassroomDetailStore from '@/stores/classroomDetailStore'
import useUploadStore from '@/stores/uploadStore'
import useLearnStore from '@/stores/learnStore'

export function resetAllStores() {
  useAuthStore.setState({ user: null, isLoading: false, isFetching: false, error: null, lastFetched: null })
  useClassroomStore.setState({ classrooms: [], isLoading: false, isFetching: false, lastFetched: null })
  useClassroomDetailStore.setState({ _data: {}, _meta: {}, _fetching: {}, _errors: {} })
  useUploadStore.setState({ queue: [], isProcessing: false, currentIndex: 0, total: 0, successCount: 0, failCount: 0 })
  useLearnStore.setState({ sessions: [], activeSessionId: null, messagesBySession: {}, isLoading: false })
}
