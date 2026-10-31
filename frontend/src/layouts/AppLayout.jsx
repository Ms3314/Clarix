import { SidebarProvider, SidebarTrigger, SidebarInset, useSidebar } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import useUploadStore from "@/stores/uploadStore"
import { X, FileText, Loader2, CheckCircle, AlertCircle, PanelLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

function UploadBanner() {
  const { queue, isProcessing, currentIndex, total, successCount, failCount, retryAll, clearAll } = useUploadStore()

  const active = queue.filter((q) => q.status === 'pending' || q.status === 'uploading')
  const done = queue.filter((q) => q.status === 'done')
  const failed = queue.filter((q) => q.status === 'error')
  const show = queue.length > 0

  if (!show) return null

  const allDone = active.length === 0

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 flex justify-center pointer-events-none">
      <div className="bg-white border border-zinc-200 rounded-xl shadow-lg px-4 py-3 flex items-center gap-4 pointer-events-auto max-w-lg w-full">
        {allDone ? (
          <div className="flex items-center gap-2 text-sm shrink-0">
            {failCount === 0 ? (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-500" />
            )}
          </div>
        ) : (
          <Loader2 className="w-4 h-4 text-[#4a7c59] animate-spin shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          {allDone ? (
            <p className="text-xs font-medium text-zinc-700">
              {failCount === 0
                ? `Uploaded ${total} file${total !== 1 ? 's' : ''} successfully`
                : `${successCount} uploaded, ${failCount} failed`}
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-medium text-zinc-700">
                Uploading {currentIndex + 1}/{total}...
                <span className="text-zinc-400 font-normal ml-1">{active[0]?.name}</span>
              </p>
              <div className="w-full h-1 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#4a7c59] rounded-full transition-all duration-300"
                  style={{ width: `${(done.length / total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {allDone && failed.length > 0 && (
          <button onClick={retryAll} className="text-xs font-semibold text-[#4a7c59] hover:underline cursor-pointer shrink-0">
            Retry {failed.length > 1 ? `(${failed.length})` : ''}
          </button>
        )}

        <button onClick={clearAll} className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

const AppLayout = ({ children }) => {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-[#faf8f6] min-h-screen">
        <div className="flex items-center h-10 px-4 border-b border-[#e8e4e0] bg-white md:hidden">
          <SidebarTrigger />
        </div>
        <FloatingTrigger />
        {children}
        <UploadBanner />
      </SidebarInset>
    </SidebarProvider>
  )
}

function FloatingTrigger() {
  const { open } = useSidebar()
  if (open) return null
  return (
    <div className="hidden md:fixed md:flex top-3 left-3 z-50">
      <SidebarTrigger className="h-8 w-8 rounded-lg text-[#acaaa6] hover:text-[#4a4948] hover:bg-[#f0eae3]" />
    </div>
  )
}

export default AppLayout
