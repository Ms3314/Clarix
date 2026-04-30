import { Navigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"

export default function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth()

  // Still loading — don't redirect yet
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  // No user and no token in storage → go to login
  if (!user && !localStorage.getItem("clarix_token")) {
    return <Navigate to="/login" replace />
  }

  // Token exists but user not yet set (shouldn't happen after isLoading=false, but guard anyway)
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return children
}
