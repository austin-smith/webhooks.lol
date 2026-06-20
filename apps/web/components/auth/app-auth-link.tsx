"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CircleUserRoundIcon, LogOutIcon, UserIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth/client"

const authHeaderLinkClassName =
  "inline-flex h-7 items-center rounded-md px-2 text-[0.68rem] font-medium tracking-wide text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:hover:bg-muted/50"

export function AppAuthLink() {
  const router = useRouter()
  const session = authClient.useSession()
  const user = session.data?.user
  const [isSigningOut, setIsSigningOut] = React.useState(false)

  async function signOut() {
    setIsSigningOut(true)

    try {
      await authClient.signOut()
      router.push("/")
      router.refresh()
    } finally {
      setIsSigningOut(false)
    }
  }

  if (user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Account"
          >
            <CircleUserRoundIcon data-icon="inline-start" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">
            {user.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/account">
                <UserIcon />
                Account settings
              </Link>
            </DropdownMenuItem>
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

  return (
    <Link href="/login" className={authHeaderLinkClassName}>
      SIGN IN
    </Link>
  )
}
