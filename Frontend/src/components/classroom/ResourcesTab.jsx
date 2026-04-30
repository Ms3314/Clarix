import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/context/AuthContext"
import FileUploadZone from "@/components/resources/FileUploadZone"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import api from "@/lib/api"
import { FileText, Trash2, CheckCircle, Clock } from "lucide-react"

export default function ResourcesTab({ classroomId }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["resources", classroomId],
    queryFn: () => api.get(`/classrooms/${classroomId}/resources`).then((r) => r.data.resources),
  })

  async function handleDelete(resourceId) {
    try {
      await api.delete(`/classrooms/${classroomId}/resources/${resourceId}`)
      toast.success("Resource deleted")
      queryClient.invalidateQueries(["resources", classroomId])
    } catch (err) {
      toast.error(err.response?.data?.detail || "Delete failed")
    }
  }

  return (
    <div className="space-y-6">
      {user?.role === "teacher" && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Upload Resource</h3>
          <FileUploadZone classroomId={classroomId} />
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Resources ({data?.length ?? 0})
        </h3>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-lg" />)}
          </div>
        ) : data?.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No resources uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {data.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white">
                <FileText className="h-5 w-5 text-red-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{r.filename}</p>
                  <p className="text-xs text-gray-400">
                    {(r.file_size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <Badge variant={r.indexed ? "default" : "secondary"} className="shrink-0">
                  {r.indexed ? (
                    <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Indexed</span>
                  ) : (
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</span>
                  )}
                </Badge>
                {user?.role === "teacher" && (
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} className="shrink-0 text-gray-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
