import { createContext, useContext, useState, useCallback } from "react"
import api from "@/lib/api"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get("/auth/me")
      setUser(res.data)
    } catch {
      console.error("Failed to refresh user")
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
