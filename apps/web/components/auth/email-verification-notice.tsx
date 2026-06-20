"use client"

import * as React from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth/client"
import { EMAIL_VERIFICATION_CALLBACK_PATH } from "@/lib/auth/redirects"
import {
  AuthFormFeedback,
  type AuthFormFeedbackState,
} from "./auth-form-feedback"

type EmailVerificationNoticeProps = {
  callbackPath: string
  email: string
}

export function EmailVerificationNotice({
  callbackPath,
  email,
}: EmailVerificationNoticeProps) {
  const [feedback, setFeedback] = React.useState<AuthFormFeedbackState | null>(
    null
  )
  const [isResending, setIsResending] = React.useState(false)
  const loginHref = createLoginHref(callbackPath)

  async function resendVerificationEmail() {
    setIsResending(true)
    setFeedback(null)

    try {
      const result = await authClient.sendVerificationEmail({
        callbackURL: EMAIL_VERIFICATION_CALLBACK_PATH,
        email,
      })

      if (result.error) {
        setFeedback({
          title: result.error.message ?? "Could not resend verification email.",
          tone: "error",
        })
        return
      }

      setFeedback({
        title: "Verification email sent.",
        tone: "success",
      })
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 text-center">
        <h2 className="font-heading text-base">Check your email</h2>
        <p className="text-[0.68rem] leading-relaxed text-muted-foreground">
          Look for a verification link at{" "}
          <span className="text-foreground">{email}</span>.
        </p>
      </div>
      <div className="flex flex-col gap-3">
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
      {feedback ? (
        <AuthFormFeedback
          description={feedback.description}
          title={feedback.title}
          tone={feedback.tone}
        />
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
