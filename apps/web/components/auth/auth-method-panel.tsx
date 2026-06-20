"use client"

import * as React from "react"

import { AuthDivider } from "@/components/auth/auth-divider"

import { EmailAuthForm } from "./email-auth-form"
import { EmailVerificationNotice } from "./email-verification-notice"
import { GithubAuthButton } from "./github-auth-button"

type AuthMethodPanelMode = "login" | "sign-up"

type AuthMethodPanelProps = {
  callbackPath: string
  mode: AuthMethodPanelMode
}

export function AuthMethodPanel({ callbackPath, mode }: AuthMethodPanelProps) {
  const [verificationEmail, setVerificationEmail] = React.useState<
    string | null
  >(null)

  if (mode === "sign-up" && verificationEmail) {
    return (
      <EmailVerificationNotice
        callbackPath={callbackPath}
        email={verificationEmail}
      />
    )
  }

  return (
    <div className="space-y-4">
      <GithubAuthButton callbackPath={callbackPath} />
      <AuthDivider />
      <EmailAuthForm
        callbackPath={callbackPath}
        mode={mode}
        onSignUpEmailSent={setVerificationEmail}
      />
    </div>
  )
}
