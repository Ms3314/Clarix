import { useEffect, useState } from "react"
import { User } from "lucide-react"

export default function ProfilePictureAvatar({ profilePictureUrl, username, size = "md" }) {
  const [imageError, setImageError] = useState(false)

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-sm",
    lg: "w-16 h-16 text-lg",
    xl: "w-24 h-24 text-2xl",
  }

  const getInitials = (name) => {
    return (name || "U")
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const handleImageError = () => {
    setImageError(true)
  }

  const initials = getInitials(username)

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#4a7c59] to-[#3d6549] text-white border border-[#e8e4e0]`}
    >
      {profilePictureUrl && !imageError ? (
        <img
          src={profilePictureUrl}
          alt={username}
          className="w-full h-full object-cover"
          onError={handleImageError}
        />
      ) : (
        <div className="flex items-center justify-center w-full h-full">
          {initials ? initials : <User className="w-1/2 h-1/2" />}
        </div>
      )}
    </div>
  )
}
