import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/context/AuthContext"
import Navbar from "@/components/layout/Navbar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import ResourcesTab from "@/components/classroom/ResourcesTab"
import QuizzesTab from "@/components/classroom/QuizzesTab"
import FlashcardsTab from "@/components/classroom/FlashcardsTab"
import ChatTab from "@/components/classroom/ChatTab"
import InviteStudentDialog from "@/components/teacher/InviteStudentDialog"
import api from "@/lib/api"
import { ArrowLeft, Users, Copy, FileText, Bot, ClipboardList, Layers } from "lucide-react"
import { toast } from "sonner"

const BANNER_COLORS = [
  "from-teal-600 to-teal-700",
  "from-blue-600 to-blue-700",
  "from-purple-600 to-purple-700",
  "from-green-700 to-green-800",
  "from-orange-500 to-orange-600",
  "from-rose-600 to-rose-700",
]

function getBannerColor(id) {
  return BANNER_COLORS[id % BANNER_COLORS.length]
}

export default function ClassroomDetail() {
  const { id } = useParams()
  const classroomId = Number(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data: classroom, isLoading } = useQuery({
    queryKey: ["classroom", classroomId],
    queryFn: () => api.get(`/classrooms/${classroomId}`).then((r) => r.data),
  })

  function copyInviteCode() {
    navigator.clipboard.writeText(classroom.invite_code)
    toast.success("Invite code copied!")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="h-48 bg-gray-200 animate-pulse" />
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          <div className="h-6 w-64 bg-gray-200 animate-pulse rounded" />
          <div className="h-4 w-40 bg-gray-100 animate-pulse rounded" />
        </div>
      </div>
    )
  }

  if (!classroom) return null

  const bannerGradient = getBannerColor(classroomId)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Hero banner */}
      <div className={`bg-gradient-to-br ${bannerGradient} relative overflow-hidden`}>
        {/* Decorative circles */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10" />
        <div className="absolute -right-4 bottom-0 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute left-1/3 -bottom-8 w-32 h-32 rounded-full bg-white/5" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 relative">
          {/* Back button */}
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm mt-5 mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> All classes
          </button>

          <div className="pb-8 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                {classroom.name}
              </h1>
              {classroom.description && (
                <p className="text-white/75 mt-2 text-base max-w-lg">{classroom.description}</p>
              )}

              <div className="flex items-center gap-4 mt-4 flex-wrap">
                <span className="flex items-center gap-1.5 text-white/80 text-sm">
                  <Users className="h-4 w-4" />
                  {classroom.student_count ?? 0} student{classroom.student_count !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5 text-white/80 text-sm">
                  <FileText className="h-4 w-4" />
                  {classroom.resource_count ?? 0} resource{classroom.resource_count !== 1 ? "s" : ""}
                </span>
                {user?.role === "teacher" && classroom.invite_code && (
                  <button
                    onClick={copyInviteCode}
                    className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm px-3 py-1 rounded-full transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span className="font-mono tracking-wide">{classroom.invite_code}</span>
                  </button>
                )}
              </div>
            </div>

            {user?.role === "teacher" && (
              <div className="pb-1">
                <InviteStudentDialog classroomId={classroomId} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <Tabs defaultValue="resources">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <TabsList className="w-full justify-start rounded-none border-b border-gray-200 bg-white h-auto p-0 gap-0">
              {[
                { value: "resources",   icon: FileText,      label: "Resources"   },
                { value: "chat",        icon: Bot,           label: "AI Chat"     },
                { value: "quizzes",     icon: ClipboardList, label: "Quizzes"     },
                { value: "flashcards",  icon: Layers,        label: "Flashcards"  },
              ].map(({ value, icon: Icon, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="flex items-center gap-2 px-5 py-4 rounded-none text-sm font-medium text-gray-500 border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-blue-50/50 hover:text-gray-700 hover:bg-gray-50 transition-all"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="p-6">
              <TabsContent value="resources" className="mt-0">
                <ResourcesTab classroomId={classroomId} />
              </TabsContent>
              <TabsContent value="chat" className="mt-0">
                <ChatTab classroomId={classroomId} />
              </TabsContent>
              <TabsContent value="quizzes" className="mt-0">
                <QuizzesTab classroomId={classroomId} />
              </TabsContent>
              <TabsContent value="flashcards" className="mt-0">
                <FlashcardsTab classroomId={classroomId} />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
