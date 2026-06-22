import type { ComponentProps } from "react"
import { UserIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

type AvatarUser = {
  email: string
  image?: string | null
  name: string
}

type UserAvatarProps = {
  interactive?: boolean
  user: AvatarUser
  size?: ComponentProps<typeof Avatar>["size"]
}

export function UserAvatar({
  interactive = false,
  user,
  size = "default",
}: UserAvatarProps) {
  const displayName = getUserDisplayName(user)

  return (
    <Avatar size={size} className={cn(interactive && "transition-colors")}>
      {user.image ? <AvatarImage src={user.image} alt={displayName} /> : null}
      <AvatarFallback
        aria-label={displayName}
        className={cn(
          "[&_svg]:size-3.5 group-data-[size=lg]/avatar:[&_svg]:size-5 group-data-[size=sm]/avatar:[&_svg]:size-3",
          interactive &&
            "transition-colors group-hover/button:bg-accent group-hover/button:text-accent-foreground group-aria-expanded/button:bg-accent group-aria-expanded/button:text-accent-foreground"
        )}
      >
        <UserIcon aria-hidden="true" />
      </AvatarFallback>
    </Avatar>
  )
}

export function getUserDisplayName(user: AvatarUser) {
  return user.name.trim() || user.email
}
