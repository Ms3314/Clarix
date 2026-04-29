import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import api from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'

import { 
  ClassroomNav, 
  ClassroomHeader, 
  ClassroomTabs,
  OverviewTab,
  StudentsTab,
  ResourcesTab,
  QuizzesTab,
  FlashcardsTab
} from '@/components/classroom'
import ChatTab from '@/components/chat/ChatTab'

const getErrorMessage = (error) => {
  if (!error.response) return error.message || 'Network error'
  const detail = error.response.data?.detail
  if (Array.isArray(detail)) {
    return detail.map(d => d.msg || d).join(', ')
  }
  if (typeof detail === 'object') return detail.msg || JSON.stringify(detail)
  return detail || 'An error occurred'
}

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
  const [uploading, setUploading] = useState(false)
  const [editingResourceId, setEditingResourceId] = useState(null)
  const [editingFilename, setEditingFilename] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

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
      } else {
        fetchResources()
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
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
      console.error('Failed to fetch students:', getErrorMessage(error))
    }
  }

  const fetchResources = async () => {
    try {
      const res = await api.get(`/classrooms/${id}/resources`)
      setResources(res.data.resources || [])
    } catch (error) {
      console.error('Failed to fetch resources:', getErrorMessage(error))
    }
  }

  const fetchQuizzes = async () => {
    try {
      const res = await api.get(`/classrooms/${id}/quizzes`)
      setQuizzes(res.data.quizzes || [])
    } catch (error) {
      console.error('Failed to fetch quizzes:', getErrorMessage(error))
    }
  }

  const fetchFlashcards = async () => {
    try {
      const res = await api.get(`/classrooms/${id}/flashcards`)
      setFlashcards(res.data.flashcards || [])
    } catch (error) {
      console.error('Failed to fetch flashcards:', getErrorMessage(error))
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
      toast.error(getErrorMessage(error))
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
      toast.error(getErrorMessage(error))
    }
  }

  const startEditingFilename = (resource) => {
    setEditingResourceId(resource.id)
    setEditingFilename(resource.filename)
  }

  const cancelEditingFilename = () => {
    setEditingResourceId(null)
    setEditingFilename('')
  }

  const saveFilename = async (resourceId) => {
    if (!editingFilename.trim()) {
      toast.error('Filename cannot be empty')
      return
    }
    try {
      await api.put(`/classrooms/${id}/resources/${resourceId}`, {
        filename: editingFilename.trim()
      })
      toast.success('Filename updated successfully!')
      setEditingResourceId(null)
      setEditingFilename('')
      fetchResources()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setChatLoading(true)

    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }])

    try {
      const response = await api.post(`/classrooms/${id}/chat`, { query: userMessage })
      setChatMessages(prev => [...prev, { role: 'assistant', content: response.data.response }])
    } catch (error) {
      toast.error(getErrorMessage(error))
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const fetchChatHistory = async () => {
    try {
      const res = await api.get(`/classrooms/${id}/chat/history`)
      setChatMessages(res.data.messages || [])
    } catch (error) {
      console.error('Failed to fetch chat history:', getErrorMessage(error))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d0d' }}>
        <div className="text-lg" style={{ color: '#888888' }}>Loading...</div>
      </div>
    )
  }

  if (!classroom) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d0d' }}>
        <div className="text-lg" style={{ color: '#888888' }}>Classroom not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#0d0d0d' }}>
      <nav style={{ background: '#111111', borderBottom: '1px solid #333333' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <button onClick={() => navigate('/dashboard')} className="text-xl font-bold" style={{ color: '#ffffff' }}>
              ← Back to Dashboard
            </button>
            <div className="flex items-center gap-4">
              <span className="text-sm" style={{ color: '#888888' }}>
                {user?.username} ({user?.role})
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold" style={{ color: '#f0f0f0' }}>{classroom.name}</h1>
          <p className="mt-2" style={{ color: '#888888' }}>{classroom.description}</p>
          <div className="flex gap-4 mt-4 text-sm" style={{ color: '#888888' }}>
            <span>Invite Code: <strong style={{ color: '#f0f0f0' }}>{classroom.invite_code}</strong></span>
            <span>Students: {classroom.student_count || 0}</span>
          </div>
        </div>

        <div className="rounded-lg" style={{ background: '#111111', border: '1px solid #333333' }}>
          <div className="border-b" style={{ borderColor: '#333333' }}>
            <ClassroomTabs 
              activeTab={activeTab} 
              onTabChange={(tab) => {
                setActiveTab(tab)
                if (tab === 'chat') fetchChatHistory()
              }}
              user={user}
            />
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div>
                <h2 className="text-xl font-semibold mb-4" style={{ color: '#f0f0f0' }}>Classroom Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card style={{ background: '#1a1a1a', border: '1px solid #333333' }}>
                    <CardHeader>
                      <CardTitle style={{ color: '#f0f0f0' }}>Resources</CardTitle>
                      <CardDescription style={{ color: '#888888' }}>{classroom.resource_count || 0} uploaded</CardDescription>
                    </CardHeader>
                  </Card>
                  <Card style={{ background: '#1a1a1a', border: '1px solid #333333' }}>
                    <CardHeader>
                      <CardTitle style={{ color: '#f0f0f0' }}>Quizzes</CardTitle>
                      <CardDescription style={{ color: '#888888' }}>{classroom.quiz_count || 0} created</CardDescription>
                    </CardHeader>
                  </Card>
                  <Card style={{ background: '#1a1a1a', border: '1px solid #333333' }}>
                    <CardHeader>
                      <CardTitle style={{ color: '#f0f0f0' }}>Students</CardTitle>
                      <CardDescription style={{ color: '#888888' }}>{classroom.student_count || 0} enrolled</CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'students' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold" style={{ color: '#f0f0f0' }}>Students</h2>
                  <span className="text-sm" style={{ color: '#666666' }}>{students.length} enrolled</span>
                </div>

                {user?.role === 'teacher' && (
                  <div className="mb-6 p-4 rounded-lg" style={{ background: '#1a1a1a', border: '1px solid #333333' }}>
                    <h3 className="text-sm font-medium mb-3" style={{ color: '#888888' }}>Invite a Student</h3>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleInviteStudent()}
                        placeholder="Enter student email"
                        className="flex-1 px-3 py-2 rounded-md text-sm"
                        style={{
                          background: '#0d0d0d',
                          border: '1px solid #444444',
                          color: '#f0f0f0'
                        }}
                      />
                      <Button
                        onClick={handleInviteStudent}
                        disabled={inviteLoading || !inviteEmail}
                        style={{ background: '#ffffff', color: '#000000' }}
                      >
                        {inviteLoading ? 'Sending...' : 'Send Invite'}
                      </Button>
                    </div>
                    <p className="text-xs mt-2" style={{ color: '#666666' }}>
                      Or share the invite code: <strong style={{ color: '#f0f0f0' }}>{classroom.invite_code}</strong>
                    </p>
                  </div>
                )}

                {students.length === 0 ? (
                  <div className="text-center py-12">
                    <p style={{ color: '#666666' }}>No students enrolled yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {students.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between px-4 py-3 rounded-lg"
                        style={{ background: '#1a1a1a', border: '1px solid #333333' }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium" style={{ background: '#333333', color: '#ffffff' }}>
                            {student.username?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium" style={{ color: '#f0f0f0' }}>{student.username}</p>
                            <p className="text-xs" style={{ color: '#666666' }}>{student.email}</p>
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
                  <h2 className="text-xl font-semibold" style={{ color: '#f0f0f0' }}>Resources</h2>
                  {user?.role === 'teacher' && (
                    <div className="flex gap-2">
                      <input
                        type="file"
                        id="resource-upload"
                        accept=".pdf"
                        className="hidden"
                        disabled={uploading}
                        onChange={async (e) => {
                          const file = e.target.files[0]
                          if (!file) return

                          setUploading(true)
                          try {
                            toast.info('Generating upload URL...')

                            const urlResponse = await api.post(
                              `/classrooms/${id}/resources/generate-upload-url`,
                              { filename: file.name, file_size: file.size }
                            )
                            const urlData = urlResponse.data

                            toast.info('Uploading to Supabase...')

                            const { error: uploadError } = await supabase.storage
                              .from('resources')
                              .upload(urlData.file_path, file, {
                                contentType: 'application/pdf'
                              });

                            if (uploadError) throw uploadError

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
                            toast.error(getErrorMessage(error))
                          } finally {
                            setUploading(false)
                          }
                        }}
                      />
                      <Button
                        onClick={() => document.getElementById('resource-upload').click()}
                        disabled={uploading}
                        style={{ background: '#ffffff', color: '#000000' }}
                      >
                        {uploading ? 'Uploading...' : 'Upload Resource'}
                      </Button>
                    </div>
                  )}
                </div>
                {resources.length === 0 ? (
                  <p style={{ color: '#666666' }}>No resources uploaded yet.</p>
                ) : (
                  <div className="space-y-4">
                    {resources.map((resource) => (
                      <Card key={resource.id} style={{ background: '#1a1a1a', border: '1px solid #333333' }}>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              {editingResourceId === resource.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editingFilename}
                                    onChange={(e) => setEditingFilename(e.target.value)}
                                    className="px-2 py-1 rounded text-sm"
                                    style={{
                                      background: '#0d0d0d',
                                      border: '1px solid #444444',
                                      color: '#f0f0f0'
                                    }}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveFilename(resource.id)
                                      if (e.key === 'Escape') cancelEditingFilename()
                                    }}
                                  />
                                  <Button size="sm" onClick={() => saveFilename(resource.id)} style={{ background: '#ffffff', color: '#000000' }}>
                                    Save
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={cancelEditingFilename} style={{ borderColor: '#444444', color: '#f0f0f0' }}>
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <div>
                                  <a
                                    href={resource.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium cursor-pointer"
                                    style={{ color: '#ffffff' }}
                                  >
                                    {resource.filename}
                                  </a>
                                  <p className="text-sm" style={{ color: '#666666' }}>
                                    {resource.indexed ? 'Indexed' : 'Processing...'}
                                  </p>
                                </div>
                              )}
                            </div>
                            {user?.role === 'teacher' && editingResourceId !== resource.id && (
                              <div className="flex items-center gap-2 ml-4">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditingFilename(resource)}
                                  style={{ borderColor: '#444444', color: '#f0f0f0' }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteResource(resource.id)}
                                >
                                  Delete
                                </Button>
                              </div>
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
              <div className="h-[500px] flex flex-col" style={{ background: '#0d0d0d', borderRadius: '14px', overflow: 'hidden', border: '1px solid #333333' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #333333', background: '#0d0d0d' }}>
                  <h2 className="text-lg font-semibold" style={{ color: '#f0f0f0' }}>Chat with Resources</h2>
                  <p className="text-sm" style={{ color: '#888888' }}>Ask questions about your uploaded documents</p>
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {chatMessages.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666666' }}>
                      <div style={{ fontSize: '3rem', opacity: 0.4 }}>📄</div>
                      <p style={{ marginTop: '16px' }}>Ask questions about your uploaded resources</p>
                      <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>The AI will answer based on your PDFs</p>
                    </div>
                  )}

                  {chatMessages.map((msg, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      animation: 'msgIn 0.25s ease'
                    }}>
                      <div style={{
                        maxWidth: '65%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                      }}>
                        {msg.role === 'assistant' && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#666666', marginBottom: '3px', paddingLeft: '4px' }}>AI</span>
                        )}
                        <div style={{
                          padding: '10px 15px',
                          borderRadius: '18px',
                          fontSize: '0.9rem',
                          lineHeight: 1.5,
                          wordBreak: 'break-word',
                          ...(msg.role === 'user'
                            ? { background: '#ffffff', color: '#000000', borderBottomRightRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }
                            : { background: '#2a2a2a', color: '#f0f0f0', borderBottomLeftRadius: '4px', border: '1px solid #444444' }
                          )
                        }}>
                          {msg.role === 'user' ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                        </div>
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{ background: '#2a2a2a', padding: '10px 15px', borderRadius: '18px', borderBottomLeftRadius: '4px', border: '1px solid #444444' }}>
                        <span style={{ color: '#888888' }}>Thinking...</span>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ padding: '16px 24px', borderTop: '1px solid #333333', background: '#0d0d0d' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#1a1a1a', border: '1px solid #444444', borderRadius: '14px', padding: '8px 12px 8px 18px' }}>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !chatLoading) sendChatMessage() }}
                      placeholder="Ask a question about your resources..."
                      disabled={chatLoading}
                      style={{
                        flex: 1,
                        background: 'none',
                        border: 'none',
                        outline: 'none',
                        color: '#f0f0f0',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.9rem'
                      }}
                    />
                    <button
                      onClick={sendChatMessage}
                      disabled={chatLoading || !chatInput.trim()}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        border: 'none',
                        background: chatInput.trim() ? '#ffffff' : '#333333',
                        color: '#000000',
                        cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.2s, transform 0.15s',
                        flexShrink: 0
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'quizzes' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
                <div style={{ fontSize: '4rem' }}>📝</div>
                <h2 className="text-xl font-semibold mt-4" style={{ color: '#f0f0f0' }}>Coming Soon</h2>
                <p className="text-sm mt-2" style={{ color: '#666666' }}>Quiz functionality will be available soon!</p>
              </div>
            )}

            {activeTab === 'flashcards' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold" style={{ color: '#f0f0f0' }}>Flashcards</h2>
                  {user?.role === 'teacher' && (
                    <Button style={{ background: '#ffffff', color: '#000000' }}>Create Flashcard</Button>
                  )}
                </div>
                {flashcards.length === 0 ? (
                  <p style={{ color: '#666666' }}>No flashcards created yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {flashcards.map((card) => (
                      <Card key={card.id} style={{ background: '#1a1a1a', border: '1px solid #333333' }}>
                        <CardContent className="pt-6">
                          <p className="font-medium" style={{ color: '#f0f0f0' }}>{card.front}</p>
                          <p className="text-sm mt-2" style={{ color: '#888888' }}>{card.back}</p>
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
