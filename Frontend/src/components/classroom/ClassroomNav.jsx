import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import { toast } from 'sonner'

export const ClassroomNav = ({ classroom, user }) => {
  const navigate = useNavigate()

  return (
    <nav style={{ background: '#111111', borderBottom: '1px solid #333333' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="text-xl font-bold" 
            style={{ color: '#ffffff' }}
          >
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
  )
}

export const ClassroomHeader = ({ classroom, user, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(classroom.name)
  const [editDescription, setEditDescription] = useState(classroom.description || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!editName.trim()) {
      toast.error('Classroom name cannot be empty')
      return
    }
    
    setSaving(true)
    try {
      const response = await api.put(`/classrooms/${classroom.id}`, {
        name: editName.trim(),
        description: editDescription.trim()
      })
      toast.success('Classroom updated successfully!')
      setIsEditing(false)
      if (onUpdate) onUpdate(response.data)
    } catch (error) {
      const detail = error.response?.data?.detail
      if (Array.isArray(detail)) {
        toast.error(detail.map(d => d.msg || d).join(', '))
      } else {
        toast.error(detail || 'Failed to update classroom')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditName(classroom.name)
    setEditDescription(classroom.description || '')
    setIsEditing(false)
  }

  return (
    <div className="mb-6">
      {isEditing ? (
        <div className="space-y-3">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="text-3xl font-bold w-full px-3 py-2 rounded-md"
            style={{ 
              background: '#1a1a1a', 
              border: '1px solid #444444', 
              color: '#f0f0f0'
            }}
            placeholder="Classroom name"
          />
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-md"
            style={{ 
              background: '#1a1a1a', 
              border: '1px solid #444444', 
              color: '#f0f0f0'
            }}
            rows={2}
            placeholder="Description (optional)"
          />
          <div className="flex gap-2">
            <Button 
              onClick={handleSave} 
              disabled={saving}
              style={{ background: '#ffffff', color: '#000000' }}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button 
              onClick={handleCancel}
              variant="outline"
              style={{ borderColor: '#444444', color: '#f0f0f0' }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold" style={{ color: '#f0f0f0' }}>{classroom.name}</h1>
            {user?.role === 'teacher' && (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                size="sm"
                style={{ 
                  borderColor: '#444444', 
                  color: '#f0f0f0',
                  background: 'transparent'
                }}
              >
                Edit
              </Button>
            )}
          </div>
          <p className="mt-2" style={{ color: '#888888' }}>{classroom.description || 'No description'}</p>
          <div className="flex gap-4 mt-4 text-sm" style={{ color: '#888888' }}>
            <span>Invite Code: <strong style={{ color: '#f0f0f0' }}>{classroom.invite_code}</strong></span>
            <span>Students: {classroom.student_count || 0}</span>
          </div>
        </div>
      )}
    </div>
  )
}