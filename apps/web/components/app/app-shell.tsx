import type React from "react"

import { readAppBuildMetadata } from "@/lib/app-build-metadata.server"
import { readAppEnvironment } from "@/lib/app-environment"
import { AppHeader, type AppHeaderUser } from "./app-header"

type AppShellProps = {
  children: React.ReactNode
  docsUrl: string | null
  user: AppHeaderUser | null
}

export function AppShell({ children, docsUrl, user }: AppShellProps) {
  const buildMetadata = readAppBuildMetadata()
  const environment = readAppEnvironment()

  return (
    <div className="flex min-h-svh flex-col bg-background font-mono text-xs text-foreground">
      <AppHeader
        buildMetadata={buildMetadata}
        docsUrl={docsUrl}
        environment={environment}
        user={user}
      />
      {children}
    </div>
  )
}
