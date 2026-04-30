import { createContext, useContext, useState, useEffect } from "react"
import api from "@/lib/api"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("clarix_token")
    if (!token) {
      setIsLoading(false)
      return
    }
    api.get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("clarix_token")
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  async function login(username, password) {
    const res = await api.post("/auth/login", { username, password })
    localStorage.setItem("clarix_token", res.data.access_token)
    setUser(res.data.user)
    return res.data
  }

  function logout() {
    localStorage.removeItem("clarix_token")
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
