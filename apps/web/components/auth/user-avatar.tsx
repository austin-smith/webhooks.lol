import type { ComponentProps } from "react"
import { UserRound } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type AvatarUser = {
  email: string
  image?: string | null
  name: string
}

type UserAvatarProps = {
  user: AvatarUser
  size?: ComponentProps<typeof Avatar>["size"]
}

export function UserAvatar({ user, size = "default" }: UserAvatarProps) {
  const displayName = getUserDisplayName(user)

  return (
    <Avatar size={size} role="img" aria-label={displayName}>
      {user.image ? <AvatarImage src={user.image} alt="" /> : null}
      <AvatarFallback
        className="[&_svg]:size-3.5 group-data-[size=lg]/avatar:[&_svg]:size-5 group-data-[size=sm]/avatar:[&_svg]:size-3"
      >
        <UserRound aria-hidden="true" />
      </AvatarFallback>
    </Avatar>
  )
}

export function getUserDisplayName(user: AvatarUser) {
  return user.name.trim() || user.email
}
