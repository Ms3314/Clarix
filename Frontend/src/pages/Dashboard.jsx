import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import Navbar from "@/components/layout/Navbar"
import CreateClassroomDialog from "@/components/teacher/CreateClassroomDialog"
import api from "@/lib/api"
import { BookOpen, Users, MoreVertical } from "lucide-react"

const BANNER_COLORS = [
  { bg: "bg-teal-600",    text: "text-teal-600",    light: "bg-teal-50"   },
  { bg: "bg-blue-600",    text: "text-blue-600",    light: "bg-blue-50"   },
  { bg: "bg-purple-600",  text: "text-purple-600",  light: "bg-purple-50" },
  { bg: "bg-green-700",   text: "text-green-700",   light: "bg-green-50"  },
  { bg: "bg-orange-500",  text: "text-orange-500",  light: "bg-orange-50" },
  { bg: "bg-rose-600",    text: "text-rose-600",    light: "bg-rose-50"   },
]

function getColor(id) {
  return BANNER_COLORS[id % BANNER_COLORS.length]
}

function ClassroomCard({ classroom }) {
  const navigate = useNavigate()
  const color = getColor(classroom.id)
  const initials = classroom.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
      onClick={() => navigate(`/classrooms/${classroom.id}`)}
    >
      {/* Colored banner */}
      <div className={`${color.bg} relative h-28 px-4 pt-4 pb-3 flex flex-col justify-between`}>
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-10 overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white" />
          <div className="absolute -right-2 top-10 w-20 h-20 rounded-full bg-white" />
        </div>

        <div className="relative flex items-start justify-between">
          <div>
            <h3 className="text-white font-semibold text-lg leading-tight line-clamp-2">
              {classroom.name}
            </h3>
            {classroom.description && (
              <p className="text-white/75 text-xs mt-0.5 line-clamp-1">{classroom.description}</p>
            )}
          </div>
          <button
            className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/20 transition-colors -mr-1 -mt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>

        {/* Initials avatar */}
        <div className="relative">
          <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center absolute -bottom-7 right-4 shadow-md">
            <span className="text-white font-bold text-lg">{initials}</span>
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="pt-3 pb-4 px-4 mt-4">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {classroom.student_count ?? 0}
          </span>
          {classroom.invite_code && (
            <span className="flex items-center gap-1.5 font-mono text-xs bg-gray-100 px-2 py-0.5 rounded-full">
              {classroom.invite_code}
            </span>
          )}
        </div>
      </div>

      {/* Footer action bar */}
      <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-end gap-2">
        <button
          className={`text-xs font-medium ${color.text} hover:${color.light} px-3 py-1 rounded-full transition-colors`}
          onClick={(e) => { e.stopPropagation(); navigate(`/classrooms/${classroom.id}`) }}
        >
          Open →
        </button>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-28 bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ["classrooms"],
    queryFn: () => api.get("/classrooms/").then((r) => r.data.classrooms),
  })

  const isTeacher = user?.role === "teacher"

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-normal text-gray-700">
              {isTeacher ? "Teaching" : "Enrolled"}
            </h1>
          </div>
          {isTeacher && <CreateClassroomDialog />}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : data?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center mb-6">
              <BookOpen className="h-12 w-12 text-blue-300" />
            </div>
            <h2 className="text-xl font-medium text-gray-700 mb-2">
              {isTeacher ? "No classes yet" : "No enrolled classes"}
            </h2>
            <p className="text-gray-500 text-sm max-w-xs">
              {isTeacher
                ? "Create your first classroom to get started."
                : "Ask your teacher to invite you to a class."}
            </p>
            {isTeacher && (
              <div className="mt-6">
                <CreateClassroomDialog />
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {data.map((c) => (
              <ClassroomCard key={c.id} classroom={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
