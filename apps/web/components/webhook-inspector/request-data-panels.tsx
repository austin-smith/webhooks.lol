"use client"

import * as React from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSyntaxTheme } from "@/components/theme/syntax-theme-provider"
import { cn } from "@/lib/utils"

import { highlightRequestBody } from "./request-body-highlighting"
import type { RequestBodyLanguage } from "./request-formatters"

export function CodePanel({
  actions,
  className,
  language = "text",
  value,
  wrap = false,
}: {
  actions?: React.ReactNode
  className?: string
  language?: RequestBodyLanguage
  value: string
  wrap?: boolean
}) {
  const { syntaxTheme } = useSyntaxTheme()
  const highlightKey = `${syntaxTheme}\u0000${language}\u0000${value}`
  const [highlightResult, setHighlightResult] = React.useState({
    html: "",
    key: "",
  })

  React.useEffect(() => {
    let ignore = false

    void highlightRequestBody({ language, syntaxTheme, value })
      .then((html) => {
        if (!ignore) {
          setHighlightResult({ html, key: highlightKey })
        }
      })
      .catch(() => {
        if (!ignore) {
          setHighlightResult({ html: "", key: highlightKey })
        }
      })

    return () => {
      ignore = true
    }
  }, [highlightKey, language, syntaxTheme, value])

  const highlightedHtml =
    highlightResult.key === highlightKey ? highlightResult.html : ""

  return (
    <div
      className={cn(
        "relative overflow-auto rounded-md border bg-background",
        className
      )}
    >
      {actions ? (
        <div className="absolute top-2 right-2 z-10">{actions}</div>
      ) : null}
      {highlightedHtml ? (
        <div
          className={cn("request-code-panel", wrap && "wrap")}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <pre
          className={cn(
            "min-w-0 overflow-x-auto p-3 text-xs leading-relaxed text-foreground",
            wrap ? "break-words whitespace-pre-wrap" : "whitespace-pre"
          )}
        >
          {value}
        </pre>
      )}
    </div>
  )
}

export function KeyValueTable({
  className,
  values,
}: {
  className?: string
  values: Record<string, string | string[]>
}) {
  const entries = Object.entries(values)

  if (entries.length === 0) {
    return <CodePanel className={className} value="None" />
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border bg-background",
        className
      )}
    >
      <Table className="text-xs">
        <TableHeader className="bg-muted/35">
          <TableRow>
            <TableHead className="h-7 w-[10rem] px-3 text-[0.68rem] text-muted-foreground">
              KEY
            </TableHead>
            <TableHead className="h-7 px-3 text-[0.68rem] text-muted-foreground">
              VALUE
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(([key, value]) => (
            <TableRow key={key} className="hover:bg-muted/30">
              <TableCell className="w-[10rem] max-w-[10rem] truncate px-3 py-1 align-top text-xs text-muted-foreground">
                {key}
              </TableCell>
              <TableCell className="px-3 py-1 text-xs break-all whitespace-normal">
                {Array.isArray(value) ? value.join(", ") : value}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
