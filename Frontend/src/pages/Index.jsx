import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"

export default function Index() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading) {
      navigate(user ? "/dashboard" : "/login", { replace: true })
    }
  }, [user, isLoading, navigate])

  return null
}
