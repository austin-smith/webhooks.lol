import type React from "react"

import { AppShell } from "@/components/app/app-shell"
import { readDocsUrl } from "@/lib/app-urls"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell docsUrl={readDocsUrl()}>{children}</AppShell>
}
