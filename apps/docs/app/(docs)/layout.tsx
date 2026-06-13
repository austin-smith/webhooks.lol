import type { ReactNode } from "react"
import { DocsLayout } from "fumadocs-ui/layouts/docs"

import { DocsSidebarKeyboardShortcut } from "@/components/docs-sidebar-keyboard-shortcut"
import { baseOptions } from "@/lib/layout.shared"
import { source } from "@/lib/source"

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout {...baseOptions()} tree={source.getPageTree()}>
      <DocsSidebarKeyboardShortcut />
      {children}
    </DocsLayout>
  )
}
