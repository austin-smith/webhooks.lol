import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthMethodPanel } from "@/components/auth/auth-method-panel"
import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { resolveAuthRedirectPath } from "@/lib/auth/redirect-targets"
import { getCurrentSession } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Sign in | webhooks.lol",
}

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const callbackPath = resolveAuthRedirectPath((await searchParams).next)
  const session = await getCurrentSession()

  if (session) {
    redirect(callbackPath)
  }

  return (
    <AuthPageShell
      backHref="/"
      backLabel="Get back there"
      eyebrow="ACCOUNT"
      title="Sign in"
    >
      <AuthMethodPanel mode="login" callbackPath={callbackPath} />
    </AuthPageShell>
  )
}
