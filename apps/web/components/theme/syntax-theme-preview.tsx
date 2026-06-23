"use client"

import * as React from "react"

import type { SyntaxThemeOption } from "@/components/theme/syntax-theme"
import { highlightRequestBody } from "@/components/webhook-inspector/request-body-highlighting"
import { cn } from "@/lib/utils"

const previewValue = `{
  "event": "request.created",
  "status": 200
}`

const previewHtmlPromises = new Map<SyntaxThemeOption, Promise<string>>()

export function SyntaxThemePreview({
  className,
  syntaxTheme,
}: {
  className?: string
  syntaxTheme: SyntaxThemeOption
}) {
  const [previewResult, setPreviewResult] = React.useState({
    html: "",
    theme: null as SyntaxThemeOption | null,
  })

  React.useEffect(() => {
    let ignore = false

    void getSyntaxThemePreviewHtml(syntaxTheme)
      .then((html) => {
        if (!ignore) {
          setPreviewResult({ html, theme: syntaxTheme })
        }
      })
      .catch(() => {
        if (!ignore) {
          setPreviewResult({ html: "", theme: syntaxTheme })
        }
      })

    return () => {
      ignore = true
    }
  }, [syntaxTheme])

  const previewHtml =
    previewResult.theme === syntaxTheme ? previewResult.html : ""

  return (
    <div
      aria-label="Syntax theme preview"
      className={cn(
        "request-code-panel overflow-hidden rounded-md border bg-background",
        className
      )}
    >
      {previewHtml ? (
        <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
      ) : (
        <pre className="m-0 min-w-0 overflow-x-auto p-3 text-xs leading-relaxed text-foreground">
          {previewValue}
        </pre>
      )}
    </div>
  )
}

function getSyntaxThemePreviewHtml(syntaxTheme: SyntaxThemeOption) {
  const cachedHtml = previewHtmlPromises.get(syntaxTheme)

  if (cachedHtml) {
    return cachedHtml
  }

  const htmlPromise = highlightRequestBody({
    language: "json",
    syntaxTheme,
    tabIndex: false,
    value: previewValue,
  })

  previewHtmlPromises.set(syntaxTheme, htmlPromise)

  return htmlPromise
}
