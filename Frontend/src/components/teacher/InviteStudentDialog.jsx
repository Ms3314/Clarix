import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import api from "@/lib/api"
import { UserPlus } from "lucide-react"

export default function InviteStudentDialog({ classroomId }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  async function handleInvite() {
    if (!email.trim()) return
    setLoading(true)
    try {
      await api.post(`/classrooms/${classroomId}/invite`, { email })
      toast.success("Student invited successfully")
      queryClient.invalidateQueries(["classroom", classroomId])
      setOpen(false)
      setEmail("")
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to invite student")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4" /> Invite Student
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Student by Email</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Student Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@example.com"
            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleInvite} disabled={loading || !email.trim()}>
            {loading ? "Inviting..." : "Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
