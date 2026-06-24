import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { Button } from "@/components/ui/button"
import { resolveAuthRedirectPath } from "@/lib/auth/redirect-targets"
import { getCurrentSession } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Forgot password | webhooks.lol",
}

type ForgotPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const callbackPath = resolveAuthRedirectPath((await searchParams).next)
  const session = await getCurrentSession()

  if (session) {
    redirect(callbackPath === "/" ? "/account" : callbackPath)
  }

  return (
    <AuthPageShell
      backHref="/login"
      backLabel="Back to sign in"
      eyebrow="ACCOUNT"
      title="Forgot password"
    >
      <div className="flex flex-col gap-4">
        <ForgotPasswordForm callbackPath={callbackPath} />
        <Button asChild variant="outline" className="w-full rounded-sm text-xs">
          <Link href={createLoginHref(callbackPath)}>Sign in</Link>
        </Button>
      </div>
    </AuthPageShell>
  )
}

function createLoginHref(callbackPath: string) {
  if (callbackPath === "/") {
    return "/login"
  }

  return `/login?next=${encodeURIComponent(callbackPath)}`
}
