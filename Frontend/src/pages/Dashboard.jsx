import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
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
    document.cookie = 'clarix_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-gray-900">Clarix</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {user?.username} ({user?.role})
              </span>
              <Button variant="outline" onClick={handleLogout}>Logout</Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {user?.role === 'teacher' ? 'My Classrooms' : 'Enrolled Classrooms'}
            </h2>
            {user?.role === 'teacher' && (
              <Button onClick={() => setShowCreateForm(!showCreateForm)}>
                {showCreateForm ? 'Cancel' : 'Create Classroom'}
              </Button>
            )}
          </div>

          {showCreateForm && user?.role === 'teacher' && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Create New Classroom</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateClassroom} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Classroom Name</label>
                    <input
                      type="text"
                      required
                      value={newClassroom.name}
                      onChange={(e) => setNewClassroom({...newClassroom, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Enter classroom name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      value={newClassroom.description}
                      onChange={(e) => setNewClassroom({...newClassroom, description: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows="3"
                      placeholder="Enter classroom description"
                    />
                  </div>
                  <Button type="submit">Create</Button>
                </form>
              </CardContent>
            </Card>
          )}

          {classrooms.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
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
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/classroom/${classroom.id}`)}
                >
                  <CardHeader>
                    <CardTitle>{classroom.name}</CardTitle>
                    <CardDescription>{classroom.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Students: {classroom.student_count || 0}</span>
                      <span>Invite Code: {classroom.invite_code}</span>
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
