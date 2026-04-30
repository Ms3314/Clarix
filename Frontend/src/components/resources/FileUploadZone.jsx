import { useState, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import axios from "axios"
import api from "@/lib/api"
import { cn } from "@/lib/utils"
import { Upload, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

const MAX_SIZE_MB = 20

export default function FileUploadZone({ classroomId }) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)
  const queryClient = useQueryClient()

  function validate(f) {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are allowed")
      return false
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`File must be under ${MAX_SIZE_MB} MB`)
      return false
    }
    return true
  }

  function handleDragOver(e) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped && validate(dropped)) setFile(dropped)
  }

  function handleFileChange(e) {
    const selected = e.target.files[0]
    if (selected && validate(selected)) setFile(selected)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setProgress(0)
    try {
      // Step 1: get Supabase upload URL from our backend
      const { data: urlData } = await api.post(
        `/classrooms/${classroomId}/resources/generate-upload-url`,
        { filename: file.name, file_size: file.size }
      )

      // Step 2: upload file bytes directly to Supabase (bare axios — no Bearer header)
      await axios.put(urlData.upload_url, file, {
        headers: { "Content-Type": "application/octet-stream" },
        onUploadProgress: (e) =>
          setProgress(Math.round((e.loaded / e.total) * 100)),
      })

      // Step 3: register resource in our backend (triggers OCR + indexing)
      await api.post(`/classrooms/${classroomId}/resources`, {
        filename: file.name,
        file_size: file.size,
        file_path: urlData.file_path,
      })

      toast.success(`"${file.name}" uploaded and indexed`)
      queryClient.invalidateQueries(["resources", classroomId])
      setFile(null)
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ""
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          dragging
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
        {file ? (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
            <FileText className="h-4 w-4 text-blue-500" />
            <span>{file.name}</span>
            <span className="text-gray-400">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700">Drop a PDF here or click to select</p>
            <p className="text-xs text-gray-400 mt-1">PDF files only, max {MAX_SIZE_MB} MB</p>
          </>
        )}
      </div>

      {uploading && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Uploading...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {file && !uploading && (
        <div className="flex gap-2">
          <Button onClick={handleUpload} className="flex-1">
            Upload PDF
          </Button>
          <Button variant="outline" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = "" }}>
            Clear
          </Button>
        </div>
      )}
    </div>
  )
}
