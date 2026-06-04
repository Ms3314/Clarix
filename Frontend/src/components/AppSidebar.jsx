import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  LogOut,
  ChevronDown,
  BookOpen,
  BookOpenText,
  GraduationCap,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import api from "@/lib/api"

export const AppSidebar = ({ ...props }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [classrooms, setClassrooms] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, classroomsRes] = await Promise.all([
          api.get("/auth/me"),
          api.get("/classrooms/"),
        ])
        setUser(userRes.data)
        setClassrooms(classroomsRes.data.classrooms || [])
      } catch {
        console.error("Failed to fetch sidebar data")
      }
    }
    fetchData()
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("clarix_token")
    navigate("/")
  }

  const isActive = (path) => location.pathname === path
  const isClassroomActive = (id) => location.pathname === `/classroom/${id}`

  return (
    <Sidebar collapsible="icon" className="border-r border-[#e8e4e0]" {...props}>
      <SidebarHeader className="border-b border-[#e8e4e0] pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" onClick={() => navigate("/dashboard")} className="hover:bg-[#f0eae3] transition-colors">
              <div className="flex items-center gap-2.5">
                <img src="/icon.png" className="w-8 h-8 rounded-lg object-contain" />
                <div className="flex flex-col leading-none">
                  <span className="font-bold text-base tracking-tight">Clarix</span>
                  <span className="text-[10px] text-[#6b6a68] ">AI Classroom</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px]  tracking-wider text-[#acaaa6] uppercase px-4 pb-1.5">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 space-y-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive("/dashboard")}
                  tooltip="Dashboard"
                  onClick={() => navigate("/dashboard")}
                  className={`rounded-lg text-sm transition-colors ${
                    isActive("/dashboard")
                      ? "bg-[#4a7c59]/10 text-[#4a7c59] font-semibold"
                      : "text-[#4a4948] hover:bg-[#f0eae3]"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive("/learn")}
                  tooltip="Learn"
                  onClick={() => navigate("/learn")}
                  className={`rounded-lg text-sm transition-colors ${
                    isActive("/learn")
                      ? "bg-[#4a7c59]/10 text-[#4a7c59] font-semibold"
                      : "text-[#4a4948] hover:bg-[#f0eae3]"
                  }`}
                >
                  <BookOpenText className="w-4 h-4" />
                  <span>Learn</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {classrooms.length > 0 && (
          <Collapsible defaultOpen className="group/collapsible mt-1">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="text-[10px]  tracking-wider text-[#acaaa6] uppercase px-4 py-1.5 hover:bg-[#f0eae3] rounded-lg mx-2 transition-colors">
                  <span className="flex items-center gap-2">
                    Classrooms
                    <ChevronDown className="w-3 h-3 ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </span>
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu className="px-2 space-y-0.5">
                    {classrooms.map((classroom) => (
                      <SidebarMenuItem key={classroom.id}>
                        <SidebarMenuButton
                          isActive={isClassroomActive(classroom.id)}
                          tooltip={classroom.name}
                          onClick={() => navigate(`/classroom/${classroom.id}`)}
                          className={`rounded-lg text-sm transition-colors ${
                            isClassroomActive(classroom.id)
                              ? "bg-[#4a7c59]/10 text-[#4a7c59] font-semibold"
                              : "text-[#4a4948] hover:bg-[#f0eae3]"
                          }`}
                        >
                          <BookOpen className="w-4 h-4" />
                          <span>{classroom.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-[#e8e4e0] pt-2">
        <SidebarMenu className="px-2">
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="rounded-lg hover:bg-[#f0eae3] transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-[#f0eae3] flex items-center justify-center text-sm font-semibold text-[#4a7c59]">
                    {user?.username?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none text-left">
                    <span className="font-semibold text-sm text-[#1c1b1a]">{user?.username || "User"}</span>
                    <span className="text-[10px] text-[#6b6a68] font-medium capitalize">{user?.role}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 ml-auto text-[#acaaa6]" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="end"
                sideOffset={4}
                className="w-[200px] rounded-xl border border-[#e8e4e0] bg-white shadow-lg p-1"
              >
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="rounded-lg text-sm text-[#4a4948] hover:bg-[#f0eae3] cursor-pointer"
                >
                  <LogOut className="mr-2 w-4 h-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
