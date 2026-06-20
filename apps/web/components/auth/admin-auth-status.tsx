"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth/client"

import { SignedInAccount } from "./signed-in-account"

export function AdminAuthStatus() {
  const pathname = usePathname()
  const router = useRouter()
  const session = authClient.useSession()
  const user = session.data?.user
  const isLoading = session.isPending

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
      <SignedInAccount
        displayName={user.email}
        onSignOut={signOut}
      />
    )
  }

  if (isLoading) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="rounded-sm text-xs"
        disabled
      >
        Sign in
      </Button>
    )
  }

  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="rounded-sm text-xs"
    >
      <Link href="/login?next=/admin">Sign in</Link>
    </Button>
  )
}
