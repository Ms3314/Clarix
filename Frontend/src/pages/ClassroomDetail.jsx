import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

  const fetchChatHistory = async () => {
    try {
      const res = await api.get(`/classrooms/${id}/chat/history`)
      setChatMessages(res.data.messages || [])
    } catch (error) {
      console.error('Failed to fetch chat history:', getErrorMessage(error))
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

  const handleFileUpload = async (e) => {
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
      <ClassroomNav classroom={classroom} user={user} />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <ClassroomHeader 
            classroom={classroom} 
            user={user}
            onUpdate={(updated) => setClassroom(updated)}
          />

        <div className="rounded-lg" style={{ background: '#111111', border: '1px solid #333333' }}>
          <ClassroomTabs 
            activeTab={activeTab} 
            onTabChange={setActiveTab}
            onChatTabClick={fetchChatHistory}
          />

          <div className="p-6">
            {activeTab === 'overview' && (
              <OverviewTab classroom={classroom} />
            )}

            {activeTab === 'students' && (
              <StudentsTab 
                user={user}
                students={students}
                inviteEmail={inviteEmail}
                setInviteEmail={setInviteEmail}
                inviteLoading={inviteLoading}
                onInvite={handleInviteStudent}
                classroom={classroom}
              />
            )}

            {activeTab === 'resources' && (
              <ResourcesTab 
                user={user}
                resources={resources}
                uploading={uploading}
                editingResourceId={editingResourceId}
                editingFilename={editingFilename}
                onUploadClick={() => document.getElementById('resource-upload').click()}
                onStartEdit={startEditingFilename}
                onCancelEdit={cancelEditingFilename}
                onSaveEdit={saveFilename}
                onDelete={handleDeleteResource}
                onFileChange={handleFileUpload}
                onFilenameChange={setEditingFilename}
              />
            )}

            {activeTab === 'chat' && (
              <ChatTab 
                chatMessages={chatMessages}
                chatInput={chatInput}
                setChatInput={setChatInput}
                chatLoading={chatLoading}
                onSendMessage={sendChatMessage}
              />
            )}

            {activeTab === 'quizzes' && <QuizzesTab />}
            {activeTab === 'flashcards' && <FlashcardsTab />}
          </div>
        </div>
      </main>
    </div>
  )
}

export default ClassroomDetail