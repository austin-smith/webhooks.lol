"use client"

import * as React from "react"

import { GithubIcon } from "@/components/icons/github-icon"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth/client"
import { AuthFormFeedback } from "./auth-form-feedback"

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
        <GithubIcon data-icon="inline-start" aria-hidden="true" />
        Continue with GitHub
      </Button>
      {message ? <AuthFormFeedback title={message} tone="error" /> : null}
    </div>
  )
}
