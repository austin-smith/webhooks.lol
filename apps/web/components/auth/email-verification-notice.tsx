"use client"

import * as React from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth/client"
import { EMAIL_VERIFICATION_CALLBACK_PATH } from "@/lib/auth/redirects"

type EmailVerificationNoticeProps = {
  callbackPath: string
  email: string
}

export function EmailVerificationNotice({
  callbackPath,
  email,
}: EmailVerificationNoticeProps) {
  const [message, setMessage] = React.useState<string | null>(null)
  const [isResending, setIsResending] = React.useState(false)
  const loginHref = createLoginHref(callbackPath)

  async function resendVerificationEmail() {
    setIsResending(true)
    setMessage(null)

    try {
      const result = await authClient.sendVerificationEmail({
        callbackURL: EMAIL_VERIFICATION_CALLBACK_PATH,
        email,
      })

      if (result.error) {
        setMessage(result.error.message ?? "Could not resend verification email.")
        return
      }

      setMessage("Verification email sent.")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="space-y-4" role="status">
      <div className="space-y-2 text-center">
        <h2 className="font-heading text-base">Check your email</h2>
        <p className="text-[0.68rem] leading-relaxed text-muted-foreground">
          A verification link was sent to{" "}
          <span className="text-foreground">{email}</span>.
        </p>
      </div>
      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-sm text-xs"
          disabled={isResending}
          onClick={resendVerificationEmail}
        >
          Resend verification email
        </Button>
        <Button asChild className="w-full rounded-sm text-xs">
          <Link href={loginHref}>Sign in</Link>
        </Button>
      </div>
      {message ? (
        <p className="text-center text-[0.68rem] text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  )
}

function createLoginHref(callbackPath: string) {
  if (callbackPath === "/") {
    return "/login"
  }

  return `/login?next=${encodeURIComponent(callbackPath)}`
}
