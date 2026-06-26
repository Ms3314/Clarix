import { useState, useRef, useEffect } from 'react'
import {
  Save, Upload, Shuffle, Globe, Lock,
  BookOpen, HelpCircle, Layers, Megaphone,
} from 'lucide-react'
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

const FEATURES = [
  { key: 'resources_enabled', label: 'Resources', desc: 'Allow file uploads and document management', icon: BookOpen },
  { key: 'quizzes_enabled', label: 'Quizzes', desc: 'Enable quiz creation and attempts', icon: HelpCircle },
  { key: 'flashcards_enabled', label: 'Flashcards', desc: 'Allow flashcard creation and review', icon: Layers },
  { key: 'announcements_enabled', label: 'Announcements', desc: 'Post and view class announcements', icon: Megaphone },
]

export default function ClassroomSettings({ classroom, numericId, onSaved }) {
  const fileInputRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(classroom?.name || '')
  const [subject, setSubject] = useState(classroom?.subject || '')
  const [description, setDescription] = useState(classroom?.description || '')
  const [banner, setBanner] = useState(classroom?.banner || '')
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState(null)
  const [isPublic, setIsPublic] = useState(classroom?.is_public ?? true)
  const [features, setFeatures] = useState({
    resources_enabled: classroom?.resources_enabled ?? true,
    quizzes_enabled: classroom?.quizzes_enabled ?? true,
    flashcards_enabled: classroom?.flashcards_enabled ?? true,
    announcements_enabled: classroom?.announcements_enabled ?? true,
  })

  useEffect(() => {
    if (classroom) {
      setName(classroom.name || '')
      setSubject(classroom.subject || '')
      setDescription(classroom.description || '')
      setBanner(classroom.banner || '')
      setIsPublic(classroom.is_public ?? true)
      setFeatures({
        resources_enabled: classroom.resources_enabled ?? true,
        quizzes_enabled: classroom.quizzes_enabled ?? true,
        flashcards_enabled: classroom.flashcards_enabled ?? true,
        announcements_enabled: classroom.announcements_enabled ?? true,
      })
      setBannerFile(null)
      setBannerPreview(null)
    }
  }, [classroom])

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

  const randomBanner = () => {
    const available = BANNERS.filter((b) => b !== banner)
    setBanner(available[Math.floor(Math.random() * available.length)])
    setBannerFile(null)
    if (bannerPreview) {
      URL.revokeObjectURL(bannerPreview)
      setBannerPreview(null)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Class name is required')
      return
    }
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
          console.warn('Banner upload failed:', uploadErr.message)
        }
      }

      const { data } = await api.put(`/classrooms/${numericId}`, {
        name: name.trim(),
        subject: subject.trim(),
        description: description.trim(),
        banner: bannerUrl,
        is_public: isPublic,
        ...features,
      })
      toast.success('Settings saved')
      onSaved?.(data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const toggleFeature = (key) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      {/* Banner */}
      <div className="relative rounded-xl overflow-hidden bg-zinc-200 h-40 sm:h-48">
        {(bannerPreview || banner) && (
          <img
            src={bannerPreview || banner}
            alt="Classroom banner"
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
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
            {bannerFile ? 'Change' : 'Upload'}
          </button>
          <button
            type="button"
            onClick={randomBanner}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/90 rounded-lg hover:bg-white transition-colors text-zinc-700 cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" />
            Random
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-[#e8e4e0] shadow-sm">
            <div className="px-6 py-4 border-b border-[#e8e4e0]">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-600">Class Details</h3>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-2">
                  Class name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#d4d0cc] text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/20 focus:border-[#4a7c59] transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Mathematics, Science, History"
                  className="w-full px-4 py-3 rounded-xl border border-[#d4d0cc] text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/20 focus:border-[#4a7c59] transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-[#d4d0cc] text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/20 focus:border-[#4a7c59] transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="bg-white rounded-xl border border-[#e8e4e0] shadow-sm">
            <div className="px-6 py-4 border-b border-[#e8e4e0]">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-600">Features</h3>
            </div>
            <div className="p-6 space-y-4">
              {FEATURES.map((feat) => {
                const enabled = features[feat.key]
                const Icon = feat.icon
                return (
                  <div
                    key={feat.key}
                    className="flex items-center justify-between p-4 rounded-xl border border-[#eae7e4] bg-[#fdfaf7]/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${enabled ? 'bg-[#4a7c59]/10 text-[#4a7c59]' : 'bg-zinc-100 text-zinc-400'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-800">{feat.label}</p>
                        <p className="text-xs text-zinc-400">{feat.desc}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFeature(feat.key)}
                      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                        enabled ? 'bg-[#4a7c59]' : 'bg-zinc-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                          enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Visibility */}
          <div className="bg-white rounded-xl border border-[#e8e4e0] shadow-sm">
            <div className="px-6 py-4 border-b border-[#e8e4e0]">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-600">Visibility</h3>
            </div>
            <div className="p-6 space-y-3">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  isPublic
                    ? 'border-[#4a7c59] bg-[#4a7c59]/5 ring-1 ring-[#4a7c59]/30'
                    : 'border-[#d4d0cc] bg-white hover:border-zinc-300'
                }`}
              >
                <div className={`p-2 rounded-lg ${isPublic ? 'bg-[#4a7c59]/10 text-[#4a7c59]' : 'bg-zinc-100 text-zinc-500'}`}>
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isPublic ? 'text-[#4a7c59]' : 'text-zinc-700'}`}>Public</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Anyone with the code can join</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  !isPublic
                    ? 'border-[#4a7c59] bg-[#4a7c59]/5 ring-1 ring-[#4a7c59]/30'
                    : 'border-[#d4d0cc] bg-white hover:border-zinc-300'
                }`}
              >
                <div className={`p-2 rounded-lg ${!isPublic ? 'bg-[#4a7c59]/10 text-[#4a7c59]' : 'bg-zinc-100 text-zinc-500'}`}>
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${!isPublic ? 'text-[#4a7c59]' : 'text-zinc-700'}`}>Private</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Only invited students can join</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl bg-[#4a7c59] text-white hover:bg-[#3d6b4c] disabled:bg-zinc-200 disabled:text-zinc-400 transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
