"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth/client"
import { EMAIL_VERIFICATION_CALLBACK_PATH } from "@/lib/auth/redirects"

type EmailAuthMode = "login" | "sign-up"

type EmailAuthFormProps = {
  callbackPath: string
  mode: EmailAuthMode
  onSignUpEmailSent?: (email: string) => void
}

export function EmailAuthForm({
  callbackPath,
  mode,
  onSignUpEmailSent,
}: EmailAuthFormProps) {
  const router = useRouter()
  const isSignUp = mode === "sign-up"
  const switchAuthHref = createSwitchAuthHref({ callbackPath, isSignUp })
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [message, setMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  async function submitEmailAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    try {
      const emailAddress = email.trim()
      const result = isSignUp
        ? await authClient.signUp.email({
            callbackURL: EMAIL_VERIFICATION_CALLBACK_PATH,
            email: emailAddress,
            name: emailAddress,
            password,
          })
        : await authClient.signIn.email({
            callbackURL: callbackPath,
            email: emailAddress,
            password,
          })

      if (result.error) {
        if (!isSignUp && isEmailNotVerifiedError(result.error)) {
          await sendVerificationEmail(emailAddress)
          return
        }

        setMessage(result.error.message ?? "Authentication failed.")
        return
      }

      if (isSignUp) {
        onSignUpEmailSent?.(emailAddress)
        return
      }

      router.push(callbackPath)
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function sendVerificationEmail(emailAddress: string) {
    const result = await authClient.sendVerificationEmail({
      callbackURL: EMAIL_VERIFICATION_CALLBACK_PATH,
      email: emailAddress,
    })

    if (result.error) {
      setMessage(result.error.message ?? "Could not send verification email.")
      return
    }

    setMessage("Verification email sent.")
  }

  return (
    <form className="space-y-3" onSubmit={submitEmailAuth}>
      <Input
        autoComplete="email"
        disabled={isSubmitting}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        type="email"
        value={email}
        required
      />
      <Input
        autoComplete={isSignUp ? "new-password" : "current-password"}
        disabled={isSubmitting}
        minLength={8}
        maxLength={128}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        type="password"
        value={password}
        required
      />
      <Button
        type="submit"
        className="w-full rounded-sm text-xs"
        disabled={isSubmitting}
      >
        {isSignUp ? "Create account" : "Sign in"}
      </Button>
      <p className="text-center text-[0.68rem] text-muted-foreground">
        {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
        <Link
          href={switchAuthHref}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {isSignUp ? "Sign in" : "Create account"}
        </Link>
      </p>
      {message ? (
        <p
          className="text-center text-[0.68rem] text-muted-foreground"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </form>
  )
}

function isEmailNotVerifiedError(error: { code?: string; message?: string }) {
  return (
    error.code === "EMAIL_NOT_VERIFIED" || error.message === "Email not verified"
  )
}

function createSwitchAuthHref({
  callbackPath,
  isSignUp,
}: {
  callbackPath: string
  isSignUp: boolean
}) {
  const pathname = isSignUp ? "/login" : "/sign-up"

  if (callbackPath === "/") {
    return pathname
  }

  return `${pathname}?next=${encodeURIComponent(callbackPath)}`
}
