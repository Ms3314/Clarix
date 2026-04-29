import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import api from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const ClassroomDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [classroom, setClassroom] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [students, setStudents] = useState([])
  const [resources, setResources] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [flashcards, setFlashcards] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)

  useEffect(() => { 
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      const [userRes, classroomRes] = await Promise.all([
        api.get('/auth/me'),
        api.get(`/classrooms/${id}`)
      ])

      setUser(userRes.data)
      setClassroom(classroomRes.data)

      if (userRes.data.role === 'teacher') {
        fetchStudents()
        fetchResources()
        fetchQuizzes()
        fetchFlashcards()
      }
    } catch (error) {
      toast.error('Failed to load classroom')
      if (error.response?.status === 401) {
        navigate('/')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchStudents = async () => {
    try {
      const res = await api.get(`/classrooms/${id}/students`)
      setStudents(res.data.students || [])
    } catch (error) {
      console.error('Failed to fetch students')
    }
  }

  const fetchResources = async () => {
    try {
      const res = await api.get(`/classrooms/${id}/resources`)
      setResources(res.data.resources || [])
    } catch (error) {
      console.error('Failed to fetch resources')
    }
  }

  const fetchQuizzes = async () => {
    try {
      const res = await api.get(`/classrooms/${id}/quizzes`)
      setQuizzes(res.data.quizzes || [])
    } catch (error) {
      console.error('Failed to fetch quizzes')
    }
  }

  const fetchFlashcards = async () => {
    try {
      const res = await api.get(`/classrooms/${id}/flashcards`)
      setFlashcards(res.data.flashcards || [])
    } catch (error) {
      console.error('Failed to fetch flashcards')
    }
  }

  const handleInviteStudent = async () => {
    if (!inviteEmail) return
    setInviteLoading(true)
    try {
      await api.post(`/classrooms/${id}/invite`, { email: inviteEmail })
      toast.success('Student invited successfully!')
      setInviteEmail('')
      fetchStudents()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to invite student')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleDeleteResource = async (resourceId) => {
    try {
      await api.delete(`/classrooms/${id}/resources/${resourceId}`)
      toast.success('Resource deleted successfully!')
      fetchResources()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete resource')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!classroom) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Classroom not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <button onClick={() => navigate('/dashboard')} className="text-xl font-bold text-gray-900">
              ← Back to Dashboard
            </button>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {user?.username} ({user?.role})
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{classroom.name}</h1>
          <p className="text-gray-600 mt-2">{classroom.description}</p>
          <div className="flex gap-4 mt-4 text-sm text-gray-600">
            <span>Invite Code: <strong>{classroom.invite_code}</strong></span>
            <span>Students: {classroom.student_count || 0}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
            {['overview', 'students', 'resources', 'chat', 'quizzes', 'flashcards'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 px-6 font-medium text-sm ${
                    activeTab === tab
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Classroom Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Resources</CardTitle>
                      <CardDescription>{classroom.resource_count || 0} uploaded</CardDescription>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Quizzes</CardTitle>
                      <CardDescription>{classroom.quiz_count || 0} created</CardDescription>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Students</CardTitle>
                      <CardDescription>{classroom.student_count || 0} enrolled</CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'students' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">Students</h2>
                  <span className="text-sm text-gray-500">{students.length} enrolled</span>
                </div>

                {user?.role === 'teacher' && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Invite a Student</h3>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleInviteStudent()}
                        placeholder="Enter student email"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Button
                        onClick={handleInviteStudent}
                        disabled={inviteLoading || !inviteEmail}
                      >
                        {inviteLoading ? 'Sending...' : 'Send Invite'}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Or share the invite code: <strong>{classroom.invite_code}</strong>
                    </p>
                  </div>
                )}

                {students.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No students enrolled yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {students.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm">
                            {student.username?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{student.username}</p>
                            <p className="text-xs text-gray-500">{student.email}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'resources' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Resources</h2>
                  {user?.role === 'teacher' && (
                    <div className="flex gap-2">
                      <input
                        type="file"
                        id="resource-upload"
                        accept=".pdf"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files[0]
                          if (!file) return

                          try {
                            toast.info('Generating upload URL...')
                            
                            const { data: urlData } = await api.post(
                              `/classrooms/${id}/resources/generate-upload-url`,
                              { filename: file.name, file_size: file.size }
                            )

                            toast.info('Uploading to Supabase...')
                            
                            const uploadResponse = await fetch(urlData.upload_url, {
                              method: 'PUT',
                              body: file,
                              headers: {
                                'Content-Type': 'application/pdf'
                              }
                            })

                            if (!uploadResponse.ok) throw new Error('Upload failed')

                            toast.info('Creating resource record...')

                            await api.post(`/classrooms/${id}/resources`, {
                              filename: file.name,
                              file_size: file.size,
                              file_path: urlData.file_path
                            })

                            toast.success('Resource uploaded and indexing started!')
                            fetchResources()
                          } catch (error) {
                            console.error('Upload error:', error)
                            toast.error(error.response?.data?.detail || error.message || 'Failed to upload resource')
                          }
                        }}
                      />
                      <Button onClick={() => document.getElementById('resource-upload').click()}>
                        Upload Resource
                      </Button>
                    </div>
                  )}
                </div>
                {resources.length === 0 ? (
                  <p className="text-gray-500">No resources uploaded yet.</p>
                ) : (
                  <div className="space-y-4">
                    {resources.map((resource) => (
                      <Card key={resource.id}>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{resource.filename}</p>
                              <p className="text-sm text-gray-600">
                                {resource.indexed ? 'Indexed' : 'Processing...'}
                              </p>
                            </div>
                            {user?.role === 'teacher' && (
                              <Button variant="destructive" size="sm" onClick={() => handleDeleteResource(resource.id)}>
                                Delete
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'chat' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Chat with Resources</h2>
                <div className="bg-gray-50 rounded-lg p-4 h-96 flex items-center justify-center">
                  <p className="text-gray-500">Chat interface coming soon...</p>
                </div>
              </div>
            )}

            {activeTab === 'quizzes' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Quizzes</h2>
                  {user?.role === 'teacher' && (
                    <Button>Create Quiz</Button>
                  )}
                </div>
                {quizzes.length === 0 ? (
                  <p className="text-gray-500">No quizzes created yet.</p>
                ) : (
                  <div className="space-y-4">
                    {quizzes.map((quiz) => (
                      <Card key={quiz.id}>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{quiz.title}</p>
                              <p className="text-sm text-gray-600">
                                {quiz.question_count} questions
                                {quiz.is_ai_generated && ' (AI Generated)'}
                              </p>
                            </div>
                            <Button variant="outline" size="sm">View</Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'flashcards' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Flashcards</h2>
                  {user?.role === 'teacher' && (
                    <Button>Create Flashcard</Button>
                  )}
                </div>
                {flashcards.length === 0 ? (
                  <p className="text-gray-500">No flashcards created yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {flashcards.map((card) => (
                      <Card key={card.id}>
                        <CardContent className="pt-6">
                          <p className="font-medium">{card.front}</p>
                          <p className="text-sm text-gray-600 mt-2">{card.back}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default ClassroomDetail
