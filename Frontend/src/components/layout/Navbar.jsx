import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import api from "@/lib/api"

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    try { await api.get("/logout") } catch {}
    logout()
    navigate("/login")
  }

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "??"

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="h-16 px-4 flex items-center gap-3">
        {/* Logo */}
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 mr-2 hover:opacity-80 transition-opacity"
        >
          {/* Clarix wavy icon */}
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" fill="#1a73e8" />
            <path d="M10 14h20M10 20h14M10 26h17" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="text-xl font-medium text-gray-700 hidden sm:block">Clarix</span>
        </button>

        <div className="flex-1" />

        {/* Right side */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-semibold flex items-center justify-center hover:ring-2 hover:ring-blue-300 transition-all"
          >
            {initials}
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-11 z-20 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-5 border-b border-gray-100 text-center">
                  <div className="w-14 h-14 rounded-full bg-blue-600 text-white text-xl font-semibold flex items-center justify-center mx-auto mb-2">
                    {initials}
                  </div>
                  <p className="font-medium text-gray-900">{user?.username}</p>
                  <p className="text-xs text-gray-500 mt-0.5 capitalize">{user?.role}</p>
                </div>
                <div className="p-2">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
