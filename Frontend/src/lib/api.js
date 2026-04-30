import axios from "axios"

const api = axios.create({
  baseURL: "http://localhost:8000",
})

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("clarix_token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.includes("/login")) {
      localStorage.removeItem("clarix_token")
      window.location.href = "/login"
    }
    return Promise.reject(err)
  }
)

export default api
