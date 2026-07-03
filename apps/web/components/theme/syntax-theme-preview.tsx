"use client"

import * as React from "react"

import type { SyntaxThemeOption } from "@/components/theme/syntax-theme"
import { getSyntaxThemePreviewHtml } from "@/components/theme/syntax-theme-preview-html"
import { cn } from "@/lib/utils"

export type SyntaxThemePreviewData = {
  html: string
  syntaxTheme: SyntaxThemeOption
}

export function SyntaxThemePreview({
  className,
  initialPreview,
  syntaxTheme,
}: {
  className?: string
  initialPreview: SyntaxThemePreviewData
  syntaxTheme: SyntaxThemeOption
}) {
  const [preview, setPreview] = React.useState(initialPreview)

  // The initial preview comes from the request-time cookie, which can lag the
  // live provider value (e.g. a replayed router-cache payload after the theme
  // changed), so re-highlight whenever the rendered theme disagrees.
  React.useEffect(() => {
    if (preview.syntaxTheme === syntaxTheme) {
      return
    }

    let ignore = false

    void getSyntaxThemePreviewHtml(syntaxTheme)
      .then((html) => {
        if (!ignore) {
          setPreview({ html, syntaxTheme })
        }
      })
      .catch(() => {
        // Keep the last rendered preview.
      })

    return () => {
      ignore = true
    }
  }, [preview.syntaxTheme, syntaxTheme])

  return (
    <div
      aria-label="Syntax theme preview"
      className={cn(
        "request-code-panel overflow-hidden rounded-md border bg-background",
        className
      )}
    >
      <div dangerouslySetInnerHTML={{ __html: preview.html }} />
    </div>
  )
}
