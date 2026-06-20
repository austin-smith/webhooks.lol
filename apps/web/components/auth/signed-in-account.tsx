"use client"

import { LogOutIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

type SignedInAccountProps = {
  displayName: string
  isSigningOut?: boolean
  onSignOut: () => void | Promise<void>
}

export function SignedInAccount({
  displayName,
  isSigningOut = false,
  onSignOut,
}: SignedInAccountProps) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="hidden max-w-36 truncate text-[0.68rem] text-muted-foreground sm:inline">
        {displayName}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-sm"
        onClick={onSignOut}
        disabled={isSigningOut}
        aria-label="Sign out"
      >
        <LogOutIcon data-icon="inline-start" />
      </Button>
    </div>
  )
}
