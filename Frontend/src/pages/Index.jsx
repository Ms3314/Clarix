import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'
import { toast } from 'sonner'

const Index = () => {
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'student'
  })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isLogin) {
        const response = await api.post('/auth/login', {
          username: formData.username,
          password: formData.password
        })
        console.log("response", response , "the token shud be saves")
        localStorage.setItem('clarix_token', response.data.access_token)

        toast.success('Login successful!')

        // Redirect based on user role
        const userRole = response.data.user.role
        console.log("this is the userRole", userRole)
        if (userRole === 'teacher') {
          navigate('/dashboard')
        } else {
          navigate('/dashboard')
        }
      } else {
        await api.post('/auth/signup', {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role
        })

        toast.success('Registration successful! Please login.')
        setIsLogin(true)
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || error.response?.data?.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isLogin ? 'Sign in to Clarix' : 'Create your account'}
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <Input
                id="username"
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Enter username"
              />
            </div>

            {!isLogin && (
              <>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="student"
                        checked={formData.role === 'student'}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="mr-2"
                      />
                      Student
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="teacher"
                        checked={formData.role === 'teacher'}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="mr-2"
                      />
                      Teacher
                    </label>
                  </div>
                </div>
              </>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter password"
              />
            </div>
          </div>

          <div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign in' : 'Register')}
            </Button>
          </div>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin)
              setFormData({ username: '', email: '', password: '', role: 'student' })
            }}
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            {isLogin ? "Don't have an account? Register" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Index
