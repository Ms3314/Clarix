import { useState, useEffect, useRef } from 'react'
import { PDFViewer } from '@embedpdf/react-pdf-viewer'
import { X, FileText, Loader2 } from 'lucide-react'
import api from '@/lib/api'

export default function PdfViewerPanel({ resource, user, classroomId, onClose }) {
  const viewerRef = useRef(null)
  const [viewerReady, setViewerReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const lastSnapshotRef = useRef(null)
  const intervalRef = useRef(null)
  const annotCapabilityRef = useRef(null)
  const [annotLoaded, setAnnotLoaded] = useState(false)

  useEffect(() => {
    if (!viewerReady) return
    let cancelled = false

    ;(async () => {
      const registryPromise = viewerRef.current?.registry
      if (!registryPromise) return
      const registry = await registryPromise
      if (cancelled) return
      const annotPlugin = registry.getPlugin('annotation')
      if (!annotPlugin) return
      annotCapabilityRef.current = annotPlugin.provides()

      try {
        const res = await api.get(`/classrooms/${classroomId}/resources/${resource.id}/annotations`)
        if (cancelled) return
        const items = res.data.annotations
        if (items && items.length > 0) {
          annotCapabilityRef.current.importAnnotations(items)
        }
      } catch {
        if (!import.meta.env.PROD) console.warn('[PdfViewer] no saved annotations')
      }

      if (cancelled) return

      let snapshotItems
      try {
        const exportTask = annotCapabilityRef.current.exportAnnotations()
        snapshotItems = await exportTask.toPromise()
      } catch {
        snapshotItems = []
      }
      lastSnapshotRef.current = JSON.stringify(snapshotItems)
      setAnnotLoaded(true)
    })()

    return () => { cancelled = true }
  }, [viewerReady, resource.id, classroomId])

  useEffect(() => {
    if (!viewerReady || !annotLoaded) return

    intervalRef.current = setInterval(async () => {
      const cap = annotCapabilityRef.current
      if (!cap) return

      try {
        const exportTask = cap.exportAnnotations()
        const currentItems = await exportTask.toPromise()
        const currentStr = JSON.stringify(currentItems)
        if (currentStr === lastSnapshotRef.current) return

        lastSnapshotRef.current = currentStr
        setSaving(true)

        await api.put(`/classrooms/${classroomId}/resources/${resource.id}/annotations`, {
          annotations: currentItems,
        })

        setLastSavedAt(Date.now())
      } catch {
        if (!import.meta.env.PROD) console.warn('[PdfViewer] auto-save failed')
      } finally {
        setSaving(false)
      }
    }, 3000)

    return () => clearInterval(intervalRef.current)
  }, [viewerReady, annotLoaded, resource.id, classroomId])

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[80vw] bg-white z-50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
            <span className="text-sm font-semibold text-zinc-800 truncate">
              {resource.filename}
            </span>
            {saving ? (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 shrink-0 flex items-center gap-1">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                Saving
              </span>
            ) : lastSavedAt ? (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 shrink-0">
                Saved
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <PDFViewer
            ref={viewerRef}
            config={{
              src: resource.file_url,
              annotations: {
                enabled: true,
                annotationAuthor: user?.username || user?.email || 'User',
              },
              export: {
                defaultFileName: resource.filename,
              },
              theme: { preference: 'light' },
              tabBar: 'never',
            }}
            style={{ height: '100%', width: '100%' }}
            onReady={() => setViewerReady(true)}
          />
        </div>
      </div>
    </>
  )
}
