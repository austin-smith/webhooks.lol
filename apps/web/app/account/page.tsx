import type { Metadata } from "next"
import type React from "react"
import { redirect } from "next/navigation"

import { AccountActions } from "@/components/auth/account-actions"
import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { ChangePasswordForm } from "@/components/auth/change-password-form"
import { formatRelativeTime } from "@/components/webhook-inspector/request-formatters"
import { getCurrentAccountSecurity } from "@/lib/auth/account-security"
import { getCurrentSession } from "@/lib/auth/session"
import {
  getAccountWebhookStats,
  type AccountWebhookStats,
} from "@webhooks-lol/webhooks-server/repository"

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

  const [accountSecurity, accountStats] = await Promise.all([
    getCurrentAccountSecurity(),
    getAccountWebhookStats(session.user.id),
  ])

  return (
    <AuthPageShell
      backHref="/"
      backLabel="Get back there"
      eyebrow="ACCOUNT"
      title="Account settings"
    >
      <div className="flex flex-col gap-4">
        <AccountMetrics stats={accountStats} />
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
        {accountSecurity.canChangePassword ? <ChangePasswordForm /> : null}
        <AccountActions />
      </div>
    </AuthPageShell>
  )
}

function AccountMetrics({ stats }: { stats: AccountWebhookStats }) {
  return (
    <section aria-label="Webhook activity" className="flex flex-col gap-2">
      <h2 className="text-[0.68rem] tracking-wide text-muted-foreground uppercase">
        Webhook activity
      </h2>
      <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(9rem,1.4fr)] gap-2">
        <AccountMetricTile
          label="Endpoints"
          value={stats.endpointCount.toLocaleString()}
          valueSize="count"
        />
        <AccountMetricTile
          label="Requests"
          value={stats.requestCount.toLocaleString()}
          valueSize="count"
        />
        <AccountMetricTile
          label="Last activity"
          value={<LastActivityValue value={stats.lastActivityAt} />}
          valueSize="compact"
        />
      </div>
    </section>
  )
}

function AccountMetricTile({
  label,
  value,
  valueSize,
}: {
  label: string
  value: React.ReactNode
  valueSize: "compact" | "count"
}) {
  return (
    <dl className="flex min-h-20 min-w-0 flex-col justify-between gap-2 rounded-md border bg-card p-3">
      <dt className="text-[0.68rem] tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={
          valueSize === "count"
            ? "min-w-0 text-lg leading-none font-medium break-words tabular-nums"
            : "min-w-0 text-sm leading-tight font-medium tabular-nums"
        }
      >
        {value}
      </dd>
    </dl>
  )
}

function LastActivityValue({ value }: { value: string | null }) {
  if (!value) {
    return "-"
  }

  return formatRelativeTime(value)
}
