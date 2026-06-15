import ProfilePictureAvatar from "@/components/ProfilePictureAvatar"

export default function StudentProfileCard({ student }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#f0eae3] transition-colors">
      <ProfilePictureAvatar 
        profilePictureUrl={student?.profile_picture_url}
        username={student?.username}
        size="md"
      />
      <div className="flex-1">
        <p className="font-semibold text-sm text-[#0d0d0d]">{student?.username}</p>
        <p className="text-xs text-[#6b6a68]">{student?.email}</p>
      </div>
    </div>
  )
}
