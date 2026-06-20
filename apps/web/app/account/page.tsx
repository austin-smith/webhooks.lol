import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AccountActions } from "@/components/auth/account-actions"
import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { getCurrentSession } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Account | webhooks.lol",
}

export default async function AccountPage() {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/login")
  }

  return (
    <AuthPageShell
      backHref="/"
      backLabel="Get back there"
      eyebrow="ACCOUNT"
      title="Account settings"
    >
      <div className="space-y-4">
        <dl className="space-y-3 rounded-md border bg-card p-3">
          <div className="min-w-0 space-y-1">
            <dt className="text-[0.68rem] tracking-wide text-muted-foreground">
              EMAIL
            </dt>
            <dd className="truncate text-sm">{session.user.email}</dd>
          </div>
        </dl>
        <AccountActions />
      </div>
    </AuthPageShell>
  )
}
