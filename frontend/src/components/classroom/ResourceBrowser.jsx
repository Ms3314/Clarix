import { useState, useMemo, useCallback } from 'react'
import { Document, Thumbnail, pdfjs } from 'react-pdf'
import { Trash2, Plus, X, Upload } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

function FolderIcon({ size = 80 }) {
  const w = size
  const h = Math.round(size * 0.75)
  return (
    <svg width={w} height={h} viewBox="0 0 72 54" fill="none">
      <path d="M4 8C4 5.79 5.79 4 8 4H28L34 12H64C66.21 12 68 13.79 68 16V48C68 50.21 66.21 52 64 52H8C5.79 52 4 50.21 4 48V8Z" fill="#4A90D9" />
      <path d="M4 18H68V48C68 50.21 66.21 52 64 52H8C5.79 52 4 50.21 4 48V18Z" fill="#3A7BC8" />
      <path d="M4 18H68V23H4V18Z" fill="#5BA0E8" opacity="0.5" />
    </svg>
  )
}

function PdfThumb({ fileUrl, size = 80 }) {
  const w = Math.round(size * 0.72)
  const h = size
  return (
    <div
      style={{ width: w, height: h, overflow: 'hidden', borderRadius: 4, border: '0.5px solid #E5E5E5', background: '#fff' }}
    >
      <Document file={fileUrl} loading={null} error={null}>
        <Thumbnail pageNumber={1} width={w} />
      </Document>
    </div>
  )
}

export default function ResourceBrowser({
  folders,
  resources,
  isTeacher,
  selectedFolderId,
  onSelectFolder,
  onOpenFile,
  onDeleteResource,
  onDeleteFolder,
  onCreateFolder,
  onMoveResource,
  onUploadFiles,
  uploadActive,
}) {
  const [showInput, setShowInput] = useState(false)
  const [inputName, setInputName] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [dragSourceId, setDragSourceId] = useState(null)

  const childFolders = useMemo(
    () => folders.filter((f) => f.parent_id === selectedFolderId),
    [folders, selectedFolderId]
  )

  const childResources = useMemo(
    () => resources.filter((r) => r.folder_id === selectedFolderId),
    [resources, selectedFolderId]
  )

  const navPath = useMemo(() => {
    const path = []
    let current = selectedFolderId ? folders.find((f) => f.id === selectedFolderId) : null
    while (current) {
      path.unshift(current)
      current = folders.find((f) => f.id === current.parent_id)
    }
    return path
  }, [folders, selectedFolderId])

  function handleClick(item) {
    setSelectedId((s) => (s === item.id ? null : item.id))
  }

  function handleDoubleClick(item) {
    if (item._type === 'folder') {
      onSelectFolder(item.id)
      setSelectedId(null)
    } else {
      onOpenFile(item)
    }
  }

  function handleCreate() {
    if (!inputName.trim()) return
    onCreateFolder(inputName.trim(), selectedFolderId)
    setInputName('')
    setShowInput(false)
  }

  const handleDragStart = useCallback((e, resId) => {
    setDragSourceId(resId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(resId))
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDragEnter = useCallback((folderId) => {
    setDragOverId(folderId)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverId(null)
  }, [])

  const handleDropOnFolder = useCallback((e, folderId) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverId(null)
    const resId = Number(e.dataTransfer.getData('text/plain')) || dragSourceId
    if (resId) onMoveResource(resId, folderId)
    setDragSourceId(null)
  }, [dragSourceId, onMoveResource])

  const handleDropOnRoot = useCallback((e) => {
    e.preventDefault()
    setDragOverId(null)
    const resId = Number(e.dataTransfer.getData('text/plain')) || dragSourceId
    if (resId) onMoveResource(resId, null)
    setDragSourceId(null)
  }, [dragSourceId, onMoveResource])

  const items = [
    ...childFolders.map((f) => ({ ...f, _type: 'folder', _name: f.name })),
    ...childResources.map((r) => ({ ...r, _type: 'file', _name: r.filename })),
  ]

  return (
    <div className="flex-1 min-w-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mb-2 text-xs text-zinc-400">
        <button onClick={() => { onSelectFolder(null); setSelectedId(null) }} className="hover:text-zinc-700 cursor-pointer font-medium">
          All Files
        </button>
        {navPath.map((f, i) => (
          <span key={f.id} className="flex items-center gap-1.5">
            <span className="text-zinc-300">›</span>
            {i < navPath.length - 1 ? (
              <button onClick={() => { onSelectFolder(f.id); setSelectedId(null) }} className="hover:text-zinc-700 cursor-pointer">
                {f.name}
              </button>
            ) : (
              <span className="text-zinc-800 font-semibold">{f.name}</span>
            )}
          </span>
        ))}
        <span className="ml-auto text-[10px] text-zinc-400">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Actions bar */}
      {isTeacher && (
        <div className="flex items-center gap-2 mb-2">
          {showInput ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setShowInput(false); setInputName('') } }}
                className="px-3 py-1.5 rounded-lg border text-xs focus:outline-none bg-white border-[#d4d2d0] w-40"
                placeholder="Folder name"
                autoFocus
              />
              <button onClick={handleCreate} className="p-1.5 text-xs font-bold text-white bg-[#4a7c59] rounded-lg hover:bg-[#32533c] cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
              <button onClick={() => { setShowInput(false); setInputName('') }} className="p-1.5 text-xs font-bold text-zinc-500 bg-white border rounded-lg hover:bg-zinc-50 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <>
              <button onClick={() => setShowInput(true)} className="flex items-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg border border-[#d4d2d0] bg-white hover:bg-zinc-50 cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
                New Folder
              </button>
              <label className="flex items-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg text-white cursor-pointer bg-[#4a7c59] hover:bg-[#32533c]">
                <Upload className="w-3.5 h-3.5" />
                {uploadActive ? 'Uploading...' : '+ Resources'}
                <input type="file" accept=".pdf" multiple className="hidden" onChange={onUploadFiles} disabled={uploadActive} />
              </label>
            </>
          )}
          {!selectedFolderId && dragSourceId && (
            <span className="text-[10px] text-zinc-400 ml-2">Drop on a folder to move</span>
          )}
        </div>
      )}

      {/* Drop zone for root level */}
      {!selectedFolderId && isTeacher && dragSourceId && (
        <div
          className="border-2 border-dashed border-[#4a7c59]/40 rounded-lg p-2 mb-2 text-center text-xs text-[#4a7c59] font-medium"
          onDragOver={handleDragOver}
          onDrop={handleDropOnRoot}
        >
          Drop here to move to root
        </div>
      )}

      {/* Grid */}
      {items.length === 0 ? (
        <div className="border-2 border-dashed border-zinc-200 rounded-xl p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-zinc-50 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4D4D4" strokeWidth="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          </div>
          <p className="text-sm font-medium text-zinc-400 mb-1">
            {selectedFolderId ? 'This folder is empty' : 'No resources yet'}
          </p>
          {isTeacher && <p className="text-xs text-zinc-300">Upload PDFs using the button above</p>}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-1.5">
          {items.map((item) => {
            const isDragOver = dragOverId === item.id && item._type === 'folder'
            return (
              <div
                key={`${item._type}-${item.id}`}
                onClick={() => handleClick(item)}
                onDoubleClick={() => handleDoubleClick(item)}
                draggable={isTeacher && item._type === 'file'}
                onDragStart={item._type === 'file' ? (e) => handleDragStart(e, item.id) : undefined}
                onDragOver={item._type === 'folder' ? handleDragOver : undefined}
                onDragEnter={item._type === 'folder' ? () => handleDragEnter(item.id) : undefined}
                onDragLeave={item._type === 'folder' ? handleDragLeave : undefined}
                onDrop={item._type === 'folder' ? (e) => handleDropOnFolder(e, item.id) : undefined}
                className={`group relative flex flex-col items-center gap-1 p-2 rounded-lg cursor-pointer select-none transition-all duration-100
                  ${isDragOver ? 'bg-[#4a7c59]/10 ring-2 ring-[#4a7c59]/40' : ''}
                `}
                style={{
                  background: selectedId === item.id ? 'rgba(74,144,217,0.08)' : isDragOver ? undefined : 'transparent',
                  outline: selectedId === item.id ? '1.5px solid rgba(74,144,217,0.4)' : '1.5px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (selectedId !== item.id && !isDragOver) e.currentTarget.style.background = 'rgba(0,0,0,0.03)'
                }}
                onMouseLeave={(e) => {
                  if (selectedId !== item.id && !isDragOver) e.currentTarget.style.background = 'transparent'
                }}
              >
                {/* Thumbnail */}
                <div className="flex items-center justify-center" style={{ height: 140 }}>
                  {item._type === 'folder' ? (
                    <FolderIcon size={140} />
                  ) : (
                    <PdfThumb fileUrl={item.file_url} size={140} />
                  )}
                </div>

                {/* Name */}
                <span className="text-xs text-zinc-800 text-center leading-tight line-clamp-2 max-w-[130px]">
                  {item._name}
                </span>

                {/* Badges */}
                {item._type === 'file' && (
                  <div className="flex items-center gap-1 flex-wrap justify-center">
                    {item.resource_type && (
                      <span className={`text-[8px] font-semibold px-1 py-0.5 rounded ${item.resource_type === 'pyq' ? 'bg-amber-100 text-amber-700' : item.resource_type === 'notes' ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-500'}`}>
                        {item.resource_type === 'pyq' ? 'PYQ' : item.resource_type === 'notes' ? 'Notes' : 'Other'}
                      </span>
                    )}
                    {item.indexed && (
                      <span className="text-[8px] font-semibold px-1 py-0.5 rounded bg-emerald-100 text-emerald-700">
                        AI Ready
                      </span>
                    )}
                  </div>
                )}

                {/* Delete */}
                {isTeacher && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedId(null); item._type === 'folder' ? onDeleteFolder(item.id) : onDeleteResource(item.id) }}
                    className="absolute top-1 right-1 p-1 bg-white/80 backdrop-blur-sm rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer shadow-sm"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
