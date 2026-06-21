import type React from "react"

import { AppHeader } from "./app-header"

type AppShellProps = {
  children: React.ReactNode
  docsUrl: string | null
}

export function AppShell({ children, docsUrl }: AppShellProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background font-mono text-xs text-foreground">
      <AppHeader docsUrl={docsUrl} />
      {children}
    </div>
  )
}
