import type React from "react"

import { AdminAuthStatus } from "@/components/auth/admin-auth-status"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RequestMethodBadge } from "@/components/webhook-inspector/request-method-badge"
import { getAdminDashboardData } from "@/lib/admin/dashboard"
import {
  AuthenticationRequiredError,
  AuthorizationRequiredError,
  requireAdminSession,
} from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const state = await getAdminPageState()

  if (state.kind === "authentication-required") {
    return (
      <AdminAccessGate
        title="Admin access"
        description="Sign in to access the admin dashboard."
      />
    )
  }

  if (state.kind === "authorization-required") {
    return (
      <AdminAccessGate
        title="Access denied"
        description="This account does not have admin access."
      />
    )
  }

  return <AdminDashboard dashboard={state.dashboard} session={state.session} />
}

async function getAdminPageState() {
  try {
    const session = await requireAdminSession()
    const dashboard = await getAdminDashboardData()

    return {
      kind: "dashboard" as const,
      dashboard,
      session,
    }
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return { kind: "authentication-required" as const }
    }

    if (error instanceof AuthorizationRequiredError) {
      return { kind: "authorization-required" as const }
    }

    throw error
  }
}

type AdminDashboardProps = {
  dashboard: Awaited<ReturnType<typeof getAdminDashboardData>>
  session: Awaited<ReturnType<typeof requireAdminSession>>
}

function AdminDashboard({ dashboard, session }: AdminDashboardProps) {
  return (
    <AdminShell>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Requests" value={dashboard.counts.requests} />
        <MetricCard label="Endpoints" value={dashboard.counts.endpoints} />
        <MetricCard label="Users" value={dashboard.counts.users} />
        <MetricCard label="Admin" value={dashboard.counts.admins} />
      </section>

      <section>
        <Card className="rounded-lg" size="sm">
          <CardHeader>
            <CardTitle>Recent traffic</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left font-mono text-[0.72rem]">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Time</th>
                  <th className="py-2 pr-3 font-medium">Method</th>
                  <th className="py-2 pr-3 font-medium">Endpoint</th>
                  <th className="py-2 pr-3 font-medium">Path</th>
                  <th className="py-2 pr-3 text-right font-medium">Bytes</th>
                  <th className="py-2 pr-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentRequests.map((request) => (
                  <tr key={request.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-muted-foreground">
                      {formatDateTime(request.receivedAt)}
                    </td>
                    <td className="py-2 pr-3">
                      <RequestMethodBadge method={request.method} />
                    </td>
                    <td className="max-w-36 truncate py-2 pr-3">
                      {request.endpointId}
                    </td>
                    <td className="max-w-72 truncate py-2 pr-3">
                      {request.path}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {request.bodySize.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {request.ip ?? "-"}
                    </td>
                  </tr>
                ))}
                {dashboard.recentRequests.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No captured requests yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <footer className="font-mono text-[0.68rem] text-muted-foreground">
        Signed in as {session.user.email} with {session.role} access.
      </footer>
    </AdminShell>
  )
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="font-heading text-lg">Admin</h1>
          <p className="font-mono text-xs text-muted-foreground">
            App-wide activity
          </p>
        </div>
        <AdminAuthStatus />
      </header>
      {children}
    </main>
  )
}

function AdminAccessGate({
  description,
  title,
}: {
  description: string
  title: string
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-4 p-4 sm:p-6">
      <div className="space-y-2 border-b pb-4">
        <p className="font-mono text-xs text-muted-foreground">webhooks.lol</p>
        <h1 className="font-heading text-lg">{title}</h1>
      </div>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <AdminAuthStatus />
      </div>
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-lg" size="sm">
      <CardHeader>
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="font-mono text-2xl">
        {value.toLocaleString()}
      </CardContent>
    </Card>
  )
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date)
}
