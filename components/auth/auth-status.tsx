"use client"

import { LogOutIcon } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth/client"

export function AuthStatus() {
  const pathname = usePathname()
  const router = useRouter()
  const session = authClient.useSession()
  const user = session.data?.user
  const isLoading = session.isPending

  async function signInWithGitHub() {
    await authClient.signIn.social({
      provider: "github",
      callbackURL: window.location.href,
    })
  }

  async function signOut() {
    await authClient.signOut()

    if (pathname.startsWith("/admin")) {
      router.replace("/")
      return
    }

    router.refresh()
  }

  if (user) {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="hidden max-w-36 truncate text-[0.68rem] text-muted-foreground sm:inline">
          {user.name || user.email}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-sm"
          onClick={signOut}
          aria-label="Sign out"
        >
          <LogOutIcon data-icon="inline-start" />
        </Button>
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="rounded-sm text-xs"
      disabled={isLoading}
      onClick={signInWithGitHub}
    >
      Sign in
    </Button>
  )
}
