import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
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
        localStorage.setItem('clarix_token', response.data.access_token)
        toast.success('Login successful!')
        navigate('/dashboard')
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
      const detail = error.response?.data?.detail
      if (Array.isArray(detail)) {
        toast.error(detail.map(d => d.msg || d).join(', '))
      } else {
        toast.error(detail || error.response?.data?.message || 'An error occurred')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0d0d0d' }}>
      <Card className="w-full max-w-md" style={{ background: '#111111', border: '1px solid #333333' }}>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: '#ffffff' }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: '#000000' }}>C</span>
          </div>
          <CardTitle style={{ color: '#f0f0f0', fontSize: '1.75rem' }}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </CardTitle>
          <CardDescription style={{ color: '#888888' }}>
            {isLogin ? 'Sign in to continue to Clarix' : 'Join Clarix to start learning'}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2" style={{ color: '#888888' }}>
                Username
              </label>
              <Input
                id="username"
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Enter username"
                style={{ 
                  background: '#1a1a1a', 
                  border: '1px solid #444444', 
                  color: '#f0f0f0',
                  padding: '12px'
                }}
              />
            </div>

            {!isLogin && (
              <>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: '#888888' }}>
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter email"
                    style={{ 
                      background: '#1a1a1a', 
                      border: '1px solid #444444', 
                      color: '#f0f0f0',
                      padding: '12px'
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#888888' }}>
                    I am a
                  </label>
                  <div className="flex gap-4">
                    <label 
                      className="flex items-center gap-2 cursor-pointer px-4 py-3 rounded-lg border transition-all"
                      style={{ 
                        border: formData.role === 'student' ? '1px solid #ffffff' : '1px solid #444444',
                        background: formData.role === 'student' ? '#222222' : '#1a1a1a'
                      }}
                    >
                      <input
                        type="radio"
                        value="student"
                        checked={formData.role === 'student'}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="sr-only"
                      />
                      <span style={{ color: formData.role === 'student' ? '#ffffff' : '#888888' }}>Student</span>
                    </label>
                    <label 
                      className="flex items-center gap-2 cursor-pointer px-4 py-3 rounded-lg border transition-all"
                      style={{ 
                        border: formData.role === 'teacher' ? '1px solid #ffffff' : '1px solid #444444',
                        background: formData.role === 'teacher' ? '#222222' : '#1a1a1a'
                      }}
                    >
                      <input
                        type="radio"
                        value="teacher"
                        checked={formData.role === 'teacher'}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="sr-only"
                      />
                      <span style={{ color: formData.role === 'teacher' ? '#ffffff' : '#888888' }}>Teacher</span>
                    </label>
                  </div>
                </div>
              </>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: '#888888' }}>
                Password
              </label>
              <Input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter password"
                style={{ 
                  background: '#1a1a1a', 
                  border: '1px solid #444444', 
                  color: '#f0f0f0',
                  padding: '12px'
                }}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              style={{ 
                background: '#ffffff', 
                color: '#000000',
                padding: '12px',
                fontWeight: 600
              }}
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            </Button>
          </form>
        </CardContent>
        
        <div className="text-center pb-6">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin)
              setFormData({ username: '', email: '', password: '', role: 'student' })
            }}
            style={{ color: '#888888', fontSize: '0.875rem', background: 'none', border: 'none', cursor: 'pointer' }}
            className="hover:text-white transition-colors"
          >
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span style={{ color: '#ffffff' }}>
              {isLogin ? 'Register' : 'Sign In'}
            </span>
          </button>
        </div>
      </Card>
    </div>
  )
}

export default Index