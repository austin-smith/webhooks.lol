"use client"

import * as React from "react"

import { GithubIcon } from "@/components/icons/github-icon"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth/client"

type GithubAuthButtonProps = {
  callbackPath: string
}

export function GithubAuthButton({ callbackPath }: GithubAuthButtonProps) {
  const [message, setMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  async function continueWithGithub() {
    setIsSubmitting(true)
    setMessage(null)

    try {
      const result = await authClient.signIn.social({
        provider: "github",
        callbackURL: callbackPath,
      })

      if (result.error) {
        setMessage(result.error.message ?? "GitHub authentication failed.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full rounded-sm text-xs"
        disabled={isSubmitting}
        onClick={continueWithGithub}
      >
        <GithubIcon className="size-4" aria-hidden="true" />
        Continue with GitHub
      </Button>
      {message ? (
        <p
          className="text-center text-[0.68rem] text-muted-foreground"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
