"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOutIcon, PaletteIcon, SettingsIcon } from "lucide-react"

import type { AppHeaderUser } from "@/components/app/app-header"
import { ThemeDropdownMenuItems } from "@/components/theme/theme-dropdown-menu-items"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth/client"
import { getUserDisplayName, UserAvatar } from "./user-avatar"

export function AppAccountMenu({ user }: { user: AppHeaderUser }) {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = React.useState(false)
  const displayName = getUserDisplayName(user)

  async function signOut() {
    setIsSigningOut(true)

    try {
      await authClient.signOut()
      router.replace("/")
      router.refresh()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Account"
        >
          <UserAvatar interactive user={user} size="sm" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar user={user} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-foreground">
                {displayName}
              </span>
              <span className="block truncate">{user.email}</span>
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/account">
              <SettingsIcon />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <PaletteIcon />
              Customize
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              <ThemeDropdownMenuItems />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={isSigningOut}
            onSelect={() => {
              void signOut()
            }}
          >
            <LogOutIcon />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
