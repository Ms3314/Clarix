import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X, Users, Globe, Lock, Shuffle, Upload } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'

const BANNERS = [
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=200&fit=crop',
  'https://images.unsplash.com/photo-1523050854058-8df90110c7f1?w=800&h=200&fit=crop',
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&h=200&fit=crop',
  'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&h=200&fit=crop',
  'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&h=200&fit=crop',
  'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&h=200&fit=crop',
]

const generateCode = (prefix) => {
  const p = prefix.slice(0, 3).toUpperCase().padEnd(3, 'X')
  const rNum = Math.floor(100 + Math.random() * 899)
  return `${p}-${rNum}Z`
}

export default () => {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [banner, setBanner] = useState(BANNERS[Math.floor(Math.random() * BANNERS.length)])
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState(null)
  const [isPublic, setIsPublic] = useState(true)
  const [inviteCode, setInviteCode] = useState(generateCode('CLX'))
  const [teacherEmail, setTeacherEmail] = useState('')
  const [coTeachers, setCoTeachers] = useState([])
  const [saving, setSaving] = useState(false)

  const handleBannerSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    setBannerFile(file)
    setBannerPreview(URL.createObjectURL(file))
    setBanner('')
  }

  const removeBanner = () => {
    setBannerFile(null)
    if (bannerPreview) URL.revokeObjectURL(bannerPreview)
    setBannerPreview(null)
    setBanner(BANNERS[Math.floor(Math.random() * BANNERS.length)])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const addCoTeacher = () => {
    const email = teacherEmail.trim()
    if (!email) return
    if (coTeachers.includes(email)) {
      toast.error('Teacher already added')
      return
    }
    setCoTeachers([...coTeachers, email])
    setTeacherEmail('')
  }

  const removeCoTeacher = (email) => {
    setCoTeachers(coTeachers.filter((e) => e !== email))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      let bannerUrl = banner

      if (bannerFile) {
        try {
          const formData = new FormData()
          formData.append('file', bannerFile)
          const { data } = await api.post('/classrooms/upload-banner', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          bannerUrl = data.url
        } catch (uploadErr) {
          console.warn('Banner upload failed, using default:', uploadErr.message)
        }
      }

      await api.post('/classrooms/', {
        name: name.trim(),
        description: description.trim(),
        subject: subject.trim(),
        banner: bannerUrl,
        is_public: isPublic,
        teacher_emails: coTeachers,
      })
      toast.success('Classroom created!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Failed to create classroom')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#faf8f6] select-none">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#e8e4e0]">
        <div className="max-w-4xl mx-auto flex items-center justify-between h-14 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 -ml-2 text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-bold uppercase tracking-widest text-zinc-700">
              Create Classroom
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Banner */}
          <div className="relative rounded-xl overflow-hidden bg-zinc-200 h-48 sm:h-56">
            {(bannerPreview || banner) && (
              <img
                src={bannerPreview || banner}
                alt="Classroom banner"
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleBannerSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/90 rounded-lg hover:bg-white transition-colors text-zinc-700 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                {bannerFile ? 'Change Photo' : 'Upload Photo'}
              </button>
              {bannerFile ? (
                <button
                  type="button"
                  onClick={removeBanner}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/90 rounded-lg hover:bg-white transition-colors text-zinc-700 cursor-pointer"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  Random
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const available = BANNERS.filter((b) => b !== banner)
                    setBanner(available[Math.floor(Math.random() * available.length)])
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/90 rounded-lg hover:bg-white transition-colors text-zinc-700 cursor-pointer"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  Change Banner
                </button>
              )}
            </div>
          </div>

          {/* Main form card */}
          <div className="bg-white rounded-xl border border-[#e8e4e0] shadow-sm">
            <div className="p-6 sm:p-8 space-y-6">
              {/* Class Name */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-2">
                  Class name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (e.target.value.length > 2) {
                      setInviteCode(generateCode(e.target.value))
                    }
                  }}
                  placeholder="e.g. Mathematics 101"
                  className="w-full px-4 py-3 rounded-xl border border-[#d4d0cc] text-sm bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/20 focus:border-[#4a7c59] transition-all"
                  required
                  autoFocus
                />
              </div>

              {/* Subject */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Mathematics, Science, History"
                  className="w-full px-4 py-3 rounded-xl border border-[#d4d0cc] text-sm bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/20 focus:border-[#4a7c59] transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description for your classroom..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-[#d4d0cc] text-sm bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/20 focus:border-[#4a7c59] transition-all resize-none"
                />
              </div>

              {/* Co-teachers */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-2">
                  Co-teachers
                </label>
                <p className="text-xs text-zinc-400 mb-3">
                  Add other teachers by email to co-teach this class.
                </p>
                {coTeachers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {coTeachers.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#4a7c59]/10 text-[#4a7c59] border border-[#4a7c59]/20"
                      >
                        <Users className="w-3 h-3" />
                        {email}
                        <button
                          type="button"
                          onClick={() => removeCoTeacher(email)}
                          className="ml-0.5 text-[#4a7c59]/60 hover:text-[#4a7c59] cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCoTeacher()
                      }
                    }}
                    placeholder="teacher@example.com"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-[#d4d0cc] text-sm bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/20 focus:border-[#4a7c59] transition-all"
                  />
                  <button
                    type="button"
                    onClick={addCoTeacher}
                    className="px-4 py-2.5 rounded-xl border border-[#d4d0cc] text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
              </div>

              {/* Visibility */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-3">
                  Visibility
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPublic(true)}
                    className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      isPublic
                        ? 'border-[#4a7c59] bg-[#4a7c59]/5 ring-1 ring-[#4a7c59]/30'
                        : 'border-[#d4d0cc] bg-white hover:border-zinc-300'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${isPublic ? 'bg-[#4a7c59]/10 text-[#4a7c59]' : 'bg-zinc-100 text-zinc-500'}`}>
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${isPublic ? 'text-[#4a7c59]' : 'text-zinc-700'}`}>
                        Public
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Anyone with the code can join
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublic(false)}
                    className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      !isPublic
                        ? 'border-[#4a7c59] bg-[#4a7c59]/5 ring-1 ring-[#4a7c59]/30'
                        : 'border-[#d4d0cc] bg-white hover:border-zinc-300'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${!isPublic ? 'bg-[#4a7c59]/10 text-[#4a7c59]' : 'bg-zinc-100 text-zinc-500'}`}>
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${!isPublic ? 'text-[#4a7c59]' : 'text-zinc-700'}`}>
                        Private
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Only invited students can join
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Invite Code */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-2">
                  Invite Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-[#d4d0cc] text-sm font-bold uppercase tracking-wider bg-[#faf7f3] text-[#4a7c59] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/20 focus:border-[#4a7c59] transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setInviteCode(generateCode(name || 'CLX'))}
                    className="px-3 py-2.5 rounded-xl border border-[#d4d0cc] text-zinc-500 hover:bg-zinc-50 transition-colors cursor-pointer"
                    title="Randomize"
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pb-8">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2.5 text-sm font-semibold rounded-xl border border-[#d4d0cc] text-zinc-600 hover:bg-zinc-50 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-8 py-2.5 text-sm font-semibold rounded-xl bg-[#4a7c59] text-white hover:bg-[#3d6b4c] disabled:bg-zinc-200 disabled:text-zinc-400 transition-all cursor-pointer"
            >
              {saving ? 'Creating...' : 'Create Classroom'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
