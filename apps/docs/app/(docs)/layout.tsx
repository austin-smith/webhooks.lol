import type { CSSProperties, ReactNode } from "react"
import { DocsLayout } from "fumadocs-ui/layouts/docs"

import { DocsSidebarKeyboardShortcut } from "@/components/docs-sidebar-keyboard-shortcut"
import { baseOptions } from "@/lib/layout.shared"
import { source } from "@/lib/source"

const docsLayoutStyle: CSSProperties & Record<"--fd-layout-width", string> = {
  "--fd-layout-width": "100vw",
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      {...baseOptions()}
      containerProps={{
        style: docsLayoutStyle,
      }}
      tree={source.getPageTree()}
    >
      <DocsSidebarKeyboardShortcut />
      {children}
    </DocsLayout>
  )
}
