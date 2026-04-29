import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'
import { toast } from 'sonner'

const Dashboard = () => {
  const [user, setUser] = useState(null)
  const [classrooms, setClassrooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newClassroom, setNewClassroom] = useState({ name: '', description: '' })
  const navigate = useNavigate()

  useEffect(() => {
    fetchUserAndClassrooms()
  }, [])

  const fetchUserAndClassrooms = async () => {
    try {
      const userResponse = await api.get('/auth/me')
      setUser(userResponse.data)

      const classroomsResponse = await api.get('/classrooms/')
      setClassrooms(classroomsResponse.data.classrooms || [])
    } catch (error) {
      toast.error('Failed to load dashboard')
      if (error.response?.status === 401) {
        navigate('/')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreateClassroom = async (e) => {
    e.preventDefault()
    try {
      await api.post('/classrooms/', newClassroom)
      toast.success('Classroom created successfully!')
      setShowCreateForm(false)
      setNewClassroom({ name: '', description: '' })
      fetchUserAndClassrooms()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create classroom')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('clarix_token')
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d0d' }}>
        <div className="text-lg" style={{ color: '#888888' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#0d0d0d' }}>
      <nav style={{ background: '#111111', borderBottom: '1px solid #333333' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold" style={{ color: '#ffffff' }}>Clarix</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm" style={{ color: '#888888' }}>
                {user?.username} ({user?.role})
              </span>
              <Button 
                variant="outline" 
                onClick={handleLogout}
                style={{ 
                  borderColor: '#444444', 
                  color: '#f0f0f0',
                  background: 'transparent'
                }}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold" style={{ color: '#f0f0f0' }}>
              {user?.role === 'teacher' ? 'My Classrooms' : 'Enrolled Classrooms'}
            </h2>
            {user?.role === 'teacher' && (
              <Button 
                onClick={() => setShowCreateForm(!showCreateForm)}
                style={{ background: '#ffffff', color: '#000000' }}
              >
                {showCreateForm ? 'Cancel' : 'Create Classroom'}
              </Button>
            )}
          </div>

          {showCreateForm && user?.role === 'teacher' && (
            <Card className="mb-6" style={{ background: '#111111', border: '1px solid #333333' }}>
              <CardHeader>
                <CardTitle style={{ color: '#f0f0f0' }}>Create New Classroom</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateClassroom} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#888888' }}>Classroom Name</label>
                    <Input
                      type="text"
                      required
                      value={newClassroom.name}
                      onChange={(e) => setNewClassroom({ ...newClassroom, name: e.target.value })}
                      placeholder="Enter classroom name"
                      style={{ 
                        background: '#1a1a1a', 
                        border: '1px solid #444444', 
                        color: '#f0f0f0'
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#888888' }}>Description</label>
                    <textarea
                      value={newClassroom.description}
                      onChange={(e) => setNewClassroom({ ...newClassroom, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-md"
                      style={{ 
                        background: '#1a1a1a', 
                        border: '1px solid #444444', 
                        color: '#f0f0f0'
                      }}
                      rows="3"
                      placeholder="Enter classroom description"
                    />
                  </div>
                  <Button type="submit" style={{ background: '#ffffff', color: '#000000' }}>
                    Create
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {classrooms.length === 0 ? (
            <div className="text-center py-12">
              <p style={{ color: '#666666' }}>
                {user?.role === 'teacher'
                  ? 'No classrooms created yet. Create your first classroom!'
                  : 'No classrooms enrolled yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classrooms.map((classroom) => (
                <Card
                  key={classroom.id}
                  className="cursor-pointer transition-all"
                  style={{ 
                    background: '#111111', 
                    border: '1px solid #333333' 
                  }}
                  onClick={() => navigate(`/classroom/${classroom.id}`)}
                >
                  <CardHeader>
                    <CardTitle style={{ color: '#f0f0f0' }}>{classroom.name}</CardTitle>
                    <CardDescription style={{ color: '#888888' }}>
                      {classroom.description || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm" style={{ color: '#666666' }}>
                      <span>Students: {classroom.student_count || 0}</span>
                      <span>Code: {classroom.invite_code}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default Dashboard