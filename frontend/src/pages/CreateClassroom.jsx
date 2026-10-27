import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X, Users, Globe, Lock, Shuffle, Image, Palette, Layers, Upload, Search, Camera, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'

const BANNER_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Fuchsia', value: '#d946ef' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Slate', value: '#64748b' },
  { name: 'Zinc', value: '#71717a' },
]

const BANNER_GRADIENTS = [
  { name: 'Sunset', value: 'linear-gradient(135deg, #f97316, #ec4899)' },
  { name: 'Ocean', value: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
  { name: 'Forest', value: 'linear-gradient(135deg, #22c55e, #10b981)' },
  { name: 'Lavender', value: 'linear-gradient(135deg, #8b5cf6, #ec4899)' },
  { name: 'Coral', value: 'linear-gradient(135deg, #f43f5e, #f97316)' },
  { name: 'Night', value: 'linear-gradient(135deg, #1e293b, #475569)' },
  { name: 'Mint', value: 'linear-gradient(135deg, #a7f3d0, #34d399)' },
  { name: 'Sky', value: 'linear-gradient(135deg, #7dd3fc, #60a5fa)' },
  { name: 'Warm', value: 'linear-gradient(135deg, #fde68a, #fb923c)' },
  { name: 'Berry', value: 'linear-gradient(135deg, #c084fc, #f472b6)' },
  { name: 'Slate', value: 'linear-gradient(135deg, #94a3b8, #475569)' },
  { name: 'Tropical', value: 'linear-gradient(135deg, #2dd4bf, #fbbf24)' },
]

const BANNER_IMAGES = [
  { url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=120&fit=crop', tags: ['education', 'books', 'study'] },
  { url: 'https://images.unsplash.com/photo-1523050854058-8df90110c7f1?w=400&h=120&fit=crop', tags: ['education', 'graduation', 'students'] },
  { url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&h=120&fit=crop', tags: ['books', 'library', 'education'] },
  { url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=120&fit=crop', tags: ['study', 'writing', 'education'] },
  { url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=120&fit=crop', tags: ['education', 'classroom', 'school'] },
  { url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&h=120&fit=crop', tags: ['education', 'learning', 'study'] },
  { url: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400&h=120&fit=crop', tags: ['mountains', 'nature', 'landscape'] },
  { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=120&fit=crop', tags: ['mountains', 'nature', 'landscape', 'minimal'] },
  { url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&h=120&fit=crop', tags: ['nature', 'forest', 'green'] },
  { url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=400&h=120&fit=crop', tags: ['nature', 'forest', 'green', 'minimal'] },
  { url: 'https://images.unsplash.com/photo-1518173946687-a36f968f9832?w=400&h=120&fit=crop', tags: ['dark', 'minimal', 'abstract'] },
  { url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&h=120&fit=crop', tags: ['abstract', 'colorful', 'art'] },
  { url: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=400&h=120&fit=crop', tags: ['abstract', 'minimal', 'waves'] },
  { url: 'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=400&h=120&fit=crop', tags: ['ocean', 'nature', 'minimal', 'blue'] },
  { url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&h=120&fit=crop', tags: ['ocean', 'nature', 'blue', 'minimal'] },
  { url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=120&fit=crop', tags: ['nature', 'landscape', 'mountains'] },
  { url: 'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=400&h=120&fit=crop', tags: ['mountains', 'nature', 'landscape', 'minimal'] },
  { url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=400&h=120&fit=crop', tags: ['city', 'urban', 'architecture'] },
  { url: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=400&h=120&fit=crop', tags: ['architecture', 'minimal', 'modern'] },
  { url: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=400&h=120&fit=crop', tags: ['minimal', 'abstract', 'art'] },
  { url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=120&fit=crop', tags: ['abstract', 'dark', 'minimal', 'art'] },
  { url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&h=120&fit=crop', tags: ['nature', 'landscape', 'water'] },
  { url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=400&h=120&fit=crop', tags: ['nature', 'lake', 'mountains', 'minimal'] },
  { url: 'https://images.unsplash.com/photo-1586348943529-beaae6c28db9?w=400&h=120&fit=crop', tags: ['nature', 'green', 'forest', 'minimal'] },
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
  const [banner, setBanner] = useState('')
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState(null)
  const [selectedBannerColor, setSelectedBannerColor] = useState('')
  const [selectedBannerGradient, setSelectedBannerGradient] = useState('')
  const [showCoverPicker, setShowCoverPicker] = useState(false)
  const [coverTab, setCoverTab] = useState('colors')
  const [imageSearch, setImageSearch] = useState('')
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
    setSelectedBannerColor('')
    setSelectedBannerGradient('')
  }

  const handleColorSelect = (color) => {
    setSelectedBannerColor(color)
    setSelectedBannerGradient('')
    setBannerFile(null)
    if (bannerPreview) URL.revokeObjectURL(bannerPreview)
    setBannerPreview(null)
    setBanner('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleGradientSelect = (gradient) => {
    setSelectedBannerGradient(gradient)
    setSelectedBannerColor('')
    setBannerFile(null)
    if (bannerPreview) URL.revokeObjectURL(bannerPreview)
    setBannerPreview(null)
    setBanner('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleImageSelect = (url) => {
    setBanner(url)
    setSelectedBannerColor('')
    setSelectedBannerGradient('')
    setBannerFile(null)
    if (bannerPreview) URL.revokeObjectURL(bannerPreview)
    setBannerPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeBanner = () => {
    setBannerFile(null)
    if (bannerPreview) URL.revokeObjectURL(bannerPreview)
    setBannerPreview(null)
    setBanner('')
    setSelectedBannerColor('')
    setSelectedBannerGradient('')
    setImageSearch('')
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
        banner_color: selectedBannerColor || selectedBannerGradient || '',
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
            {selectedBannerGradient ? (
              <div className="w-full h-full" style={{ background: selectedBannerGradient }} />
            ) : selectedBannerColor ? (
              <div className="w-full h-full" style={{ backgroundColor: selectedBannerColor }} />
            ) : bannerPreview || banner ? (
              <img
                src={bannerPreview || banner}
                alt="Classroom banner"
                className="w-full h-full object-cover"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {showCoverPicker && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-20" onClick={() => setShowCoverPicker(false)} />
                  {/* Picker */}
                  <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 w-[520px] max-w-[90vw] bg-white rounded-xl border border-[#e8e4e0] shadow-2xl overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b border-[#e8e4e0]">
                      {[
                        { id: 'colors', icon: Palette, label: 'Colors' },
                        { id: 'gradients', icon: Layers, label: 'Gradients' },
                        { id: 'images', icon: Image, label: 'Images' },
                        { id: 'upload', icon: Upload, label: 'Upload' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setCoverTab(tab.id)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                            coverTab === tab.id
                              ? 'text-zinc-900 border-b-2 border-zinc-900'
                              : 'text-zinc-400 hover:text-zinc-600'
                          }`}
                        >
                          <tab.icon className="w-3.5 h-3.5" />
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Tab content */}
                    <div className="p-3 max-h-[300px] overflow-y-auto">
                      {/* Colors */}
                      {coverTab === 'colors' && (
                        <div className="grid grid-cols-6 gap-2">
                          {BANNER_COLORS.map((c) => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => { handleColorSelect(c.value); setShowCoverPicker(false) }}
                              title={c.name}
                              className={`w-full aspect-square rounded-lg border-2 transition-all cursor-pointer hover:scale-110 ${
                                selectedBannerColor === c.value
                                  ? 'border-zinc-900 scale-110 ring-2 ring-zinc-900/20'
                                  : 'border-transparent hover:border-zinc-300'
                              }`}
                              style={{ backgroundColor: c.value }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Gradients */}
                      {coverTab === 'gradients' && (
                        <div className="grid grid-cols-3 gap-2">
                          {BANNER_GRADIENTS.map((g) => (
                            <button
                              key={g.name}
                              type="button"
                              onClick={() => { handleGradientSelect(g.value); setShowCoverPicker(false) }}
                              title={g.name}
                              className="w-full h-14 rounded-lg border-2 border-transparent transition-all cursor-pointer hover:scale-105 hover:border-zinc-300"
                              style={{ background: g.value }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Images */}
                      {coverTab === 'images' && (
                        <div className="space-y-3">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                            <input
                              type="text"
                              value={imageSearch}
                              onChange={(e) => setImageSearch(e.target.value)}
                              placeholder="Search images..."
                              className="w-full pl-8 pr-3 py-2 text-xs border border-[#d4d0cc] rounded-lg bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {(imageSearch
                              ? BANNER_IMAGES.filter((img) =>
                                  img.tags.some((t) => t.includes(imageSearch.toLowerCase()))
                                )
                              : BANNER_IMAGES
                            ).map((img, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => { handleImageSelect(img.url); setShowCoverPicker(false) }}
                                className="w-full aspect-[3/1] rounded-lg overflow-hidden border-2 border-transparent transition-all cursor-pointer hover:scale-105 hover:border-zinc-300"
                              >
                                <img src={img.url} alt="" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                          {imageSearch && BANNER_IMAGES.filter((img) =>
                            img.tags.some((t) => t.includes(imageSearch.toLowerCase()))
                          ).length === 0 && (
                            <p className="text-xs text-zinc-400 text-center py-4">No images found. Try a different search.</p>
                          )}
                        </div>
                      )}

                      {/* Upload */}
                      {coverTab === 'upload' && (
                        <div className="flex flex-col items-center gap-3 py-6">
                          <div className="p-4 rounded-full bg-zinc-100">
                            <Camera className="w-6 h-6 text-zinc-400" />
                          </div>
                          <p className="text-xs text-zinc-500">Upload an image from your device</p>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => { handleBannerSelect(e); setShowCoverPicker(false) }}
                            className="hidden"
                            id="cover-upload"
                          />
                          <label
                            htmlFor="cover-upload"
                            className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                          >
                            Choose File
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => setShowCoverPicker((p) => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/90 rounded-lg hover:bg-white transition-colors text-zinc-700 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                Change Cover
              </button>

              {(selectedBannerColor || selectedBannerGradient || banner || bannerFile) && (
                <button
                  type="button"
                  onClick={removeBanner}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/90 rounded-lg hover:bg-white transition-colors text-zinc-700 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
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
