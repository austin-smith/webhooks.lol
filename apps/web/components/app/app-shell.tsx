import type React from "react"

import { AppHeader, type AppHeaderUser } from "./app-header"

type AppShellProps = {
  children: React.ReactNode
  docsUrl: string | null
  user: AppHeaderUser | null
}

export function AppShell({ children, docsUrl, user }: AppShellProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background font-mono text-xs text-foreground">
      <AppHeader docsUrl={docsUrl} user={user} />
      {children}
    </div>
  )
}
