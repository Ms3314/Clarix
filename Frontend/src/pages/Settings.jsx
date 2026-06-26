import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Camera, Trash2, LogOut, Check, X } from "lucide-react"
import { toast } from "sonner"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Loading } from "@/components/ui/loading"
import useAuthStore from "@/stores/authStore"

export default function SettingsPage() {
  const navigate = useNavigate()
  const fetchUser = useAuthStore((s) => s.fetchUser)
  const logout = useAuthStore((s) => s.logout)
  const [user, setLocalUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)

  useEffect(() => {
    fetchUserProfile()
  }, [])

  const fetchUserProfile = async () => {
    try {
      setLoading(true)
      const response = await api.get("/profile/me/details")
      setLocalUser(response.data)
      if (response.data.profile_picture_url) {
        setPreviewUrl(response.data.profile_picture_url)
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error)
      toast.error("Failed to load profile")
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB")
      return
    }

    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result)
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first")
      return
    }

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append("file", selectedFile)

      const response = await api.post("/profile/picture/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })

      setLocalUser({
        ...user,
        profile_picture_url: response.data.profile_picture_url,
      })
      setSelectedFile(null)
      fetchUser(true)
      toast.success("Profile picture updated successfully!")
    } catch (error) {
      console.error("Upload failed:", error)
      toast.error(error.response?.data?.detail || "Failed to upload profile picture")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!user?.profile_picture_url) {
      toast.error("No profile picture to delete")
      return
    }

    try {
      setDeleting(true)
      await api.delete("/profile/picture")

      setLocalUser({
        ...user,
        profile_picture_url: null,
      })
      setPreviewUrl(null)
      fetchUser(true)
      toast.success("Profile picture deleted successfully!")
    } catch (error) {
      console.error("Delete failed:", error)
      toast.error(error.response?.data?.detail || "Failed to delete profile picture")
    } finally {
      setDeleting(false)
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    setPreviewUrl(user?.profile_picture_url || null)
  }

  const handleLogout = () => {
    logout()
    toast.success("Logged out successfully")
    navigate("/")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loading size="lg" text="Loading settings..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf8f6] p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#0d0d0d] mb-2">Settings</h1>
          <p className="text-[#6b6a68]">Manage your profile and account preferences</p>
        </div>

        {/* Profile Picture Card */}
        <div className="bg-white rounded-xl border border-[#e8e4e0] p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-[#0d0d0d]">Profile Picture</h2>
            {user?.profile_picture_url && (
              <span className="text-xs px-3 py-1 bg-[#4a7c59]/10 text-[#4a7c59] rounded-full">
                Active
              </span>
            )}
          </div>

          <div className="flex gap-8">
            {/* Preview Section */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 rounded-xl overflow-hidden bg-[#f0eae3] border-2 border-[#e8e4e0] flex items-center justify-center">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="w-8 h-8 text-[#acaaa6]" />
                )}
              </div>
              <p className="text-xs text-[#6b6a68] mt-2 text-center">
                {previewUrl ? "Preview" : "No picture"}
              </p>
            </div>

            {/* Upload Section */}
            <div className="flex-1 flex flex-col justify-center">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#4a4948] mb-2">
                    Choose Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    disabled={uploading}
                    className="block w-full text-sm text-[#6b6a68]
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-[#4a7c59] file:text-white
                      hover:file:bg-[#3d6549]
                      disabled:opacity-50"
                  />
                  <p className="text-xs text-[#acaaa6] mt-1">
                    Max 5MB, JPG/PNG/WebP
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {selectedFile ? (
                    <>
                      <Button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="flex-1 bg-[#4a7c59] hover:bg-[#3d6549] text-white rounded-lg transition-colors"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        {uploading ? "Uploading..." : "Save"}
                      </Button>
                      <Button
                        onClick={handleCancel}
                        disabled={uploading}
                        variant="outline"
                        className="flex-1 border-[#e8e4e0] text-[#4a4948] hover:bg-[#f0eae3] rounded-lg"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={() => document.querySelector('input[type="file"]')?.click()}
                        className="flex-1 bg-[#4a7c59] hover:bg-[#3d6549] text-white rounded-lg transition-colors"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Upload
                      </Button>
                      {user?.profile_picture_url && (
                        <Button
                          onClick={handleDelete}
                          disabled={deleting}
                          variant="outline"
                          className="flex-1 border-red-200 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {deleting ? "Deleting..." : "Remove"}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Info Card */}
        <div className="bg-white rounded-xl border border-[#e8e4e0] p-8 mb-6">
          <h2 className="text-xl font-semibold text-[#0d0d0d] mb-4">Account Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#acaaa6] uppercase tracking-wide">
                Username
              </label>
              <p className="text-[#4a4948] font-medium mt-1">{user?.username}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#acaaa6] uppercase tracking-wide">
                Email
              </label>
              <p className="text-[#4a4948] font-medium mt-1">{user?.email}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#acaaa6] uppercase tracking-wide">
                Role
              </label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[#4a4948] font-medium capitalize">{user?.role}</span>
                <span className="text-xs px-2 py-1 bg-[#4a7c59]/10 text-[#4a7c59] rounded-full capitalize">
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Logout Card */}
        <div className="bg-white rounded-xl border border-[#e8e4e0] p-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#0d0d0d]">Account</h2>
              <p className="text-[#6b6a68] text-sm">Logout from your account</p>
            </div>
            <Button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
