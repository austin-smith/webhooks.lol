"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LogOutIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth/client"

export function AccountActions() {
  const router = useRouter()
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

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full rounded-sm text-xs"
      disabled={isSigningOut}
      onClick={signOut}
    >
      <LogOutIcon data-icon="inline-start" />
      Sign out
    </Button>
  )
}
