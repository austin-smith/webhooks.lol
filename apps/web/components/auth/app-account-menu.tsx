"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CircleUserRoundIcon,
  LogOutIcon,
  PaletteIcon,
  SettingsIcon,
} from "lucide-react"

import { appHeaderActionClassName } from "@/components/app/app-header-action"
import type { AppHeaderUser } from "@/components/app/app-header"
import { ThemeDropdownMenuItems } from "@/components/theme/theme-dropdown-menu-items"
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
import { AccountMenuIdentity } from "./account-menu-identity"

export function AppAccountMenu({ user }: { user: AppHeaderUser }) {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = React.useState(false)

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
        <button
          type="button"
          className={appHeaderActionClassName}
          aria-label="Account"
        >
          <CircleUserRoundIcon className="size-3.5" aria-hidden="true" />
          ACCOUNT
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="p-1">
          <AccountMenuIdentity user={user} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/account">
              <SettingsIcon />
              Account Settings
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
