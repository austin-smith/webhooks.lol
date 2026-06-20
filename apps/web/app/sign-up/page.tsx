import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthMethodPanel } from "@/components/auth/auth-method-panel"
import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { resolveAuthRedirectPath } from "@/lib/auth/redirects"
import { getCurrentSession } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Create account | webhooks.lol",
}

type SignUpPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const callbackPath = resolveAuthRedirectPath((await searchParams).next)
  const session = await getCurrentSession()

  if (session) {
    redirect(callbackPath)
  }

  return (
    <AuthPageShell eyebrow="ACCOUNT" title="Create account">
      <AuthMethodPanel mode="sign-up" callbackPath={callbackPath} />
    </AuthPageShell>
  )
}
