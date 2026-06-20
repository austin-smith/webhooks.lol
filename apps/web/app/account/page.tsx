import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AccountActions } from "@/components/auth/account-actions"
import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { getCurrentAccountSecurity } from "@/lib/auth/account-security"
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

  const accountSecurity = await getCurrentAccountSecurity()

  return (
    <AuthPageShell
      backHref="/"
      backLabel="Get back there"
      eyebrow="ACCOUNT"
      title="Account settings"
    >
      <div className="flex flex-col gap-4">
        <dl className="flex flex-col gap-3 rounded-md border bg-card p-3">
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-[0.68rem] tracking-wide text-muted-foreground">
              EMAIL
            </dt>
            <dd className="truncate text-sm">{session.user.email}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-[0.68rem] tracking-wide text-muted-foreground">
              SIGN-IN METHOD
            </dt>
            <dd className="truncate text-sm">
              {accountSecurity.signInMethodLabel}
            </dd>
          </div>
        </dl>
        {accountSecurity.canResetPassword ? <ResetPasswordForm /> : null}
        <AccountActions />
      </div>
    </AuthPageShell>
  )
}
