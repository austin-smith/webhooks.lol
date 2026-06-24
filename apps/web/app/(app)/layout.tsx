import type React from "react"

import { AppShell } from "@/components/app/app-shell"
import { readDocsUrl } from "@/lib/app-urls"
import { getCurrentSession } from "@/lib/auth/session"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getCurrentSession()
  const headerUser = session
    ? {
        email: session.user.email,
        image: session.user.image ?? null,
        name: session.user.name,
      }
    : null

  return (
    <AppShell docsUrl={readDocsUrl()} user={headerUser}>
      {children}
    </AppShell>
  )
}
