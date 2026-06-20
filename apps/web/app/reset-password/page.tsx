import type { Metadata } from "next"
import Link from "next/link"

import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { PasswordResetTokenForm } from "@/components/auth/password-reset-token-form"
import { Button } from "@/components/ui/button"
import { resolveAuthRedirectPath } from "@/lib/auth/redirects"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Reset password | webhooks.lol",
}

type ResetPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = await searchParams
  const token = readSearchParam(params.token)
  const error = readSearchParam(params.error)
  const callbackPath = resolveAuthRedirectPath(params.next)
  const isInvalidLink = Boolean(error) || !token

  return (
    <AuthPageShell
      backHref="/login"
      backLabel="Back to sign in"
      eyebrow="ACCOUNT"
      title={isInvalidLink ? "Reset link expired" : "Reset password"}
    >
      {isInvalidLink ? (
        <div className="flex flex-col gap-4">
          <p className="text-center text-[0.68rem] leading-relaxed text-muted-foreground">
            This reset link is invalid or expired.
          </p>
          <Button asChild className="w-full rounded-sm text-xs">
            <Link href={createForgotPasswordHref(callbackPath)}>
              Request new reset link
            </Link>
          </Button>
        </div>
      ) : (
        <PasswordResetTokenForm callbackPath={callbackPath} token={token} />
      )}
    </AuthPageShell>
  )
}

function createForgotPasswordHref(callbackPath: string) {
  if (callbackPath === "/") {
    return "/forgot-password"
  }

  return `/forgot-password?next=${encodeURIComponent(callbackPath)}`
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
