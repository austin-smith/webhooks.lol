import type { ComponentProps } from "react"
import { UserIcon } from "lucide-react"

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
    <Avatar size={size}>
      {user.image ? <AvatarImage src={user.image} alt={displayName} /> : null}
      <AvatarFallback
        aria-label={displayName}
        className="[&_svg]:size-3.5 group-data-[size=lg]/avatar:[&_svg]:size-5 group-data-[size=sm]/avatar:[&_svg]:size-3"
      >
        <UserIcon aria-hidden="true" />
      </AvatarFallback>
    </Avatar>
  )
}

export function getUserDisplayName(user: AvatarUser) {
  return user.name.trim() || user.email
}
