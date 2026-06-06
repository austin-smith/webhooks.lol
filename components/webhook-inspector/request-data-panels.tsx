"use client"

import * as React from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import { highlightRequestBody } from "./request-body-highlighting"
import type { RequestBodyLanguage } from "./request-formatters"

export function CodePanel({
  actions,
  language = "text",
  value,
  wrap = false,
}: {
  actions?: React.ReactNode
  language?: RequestBodyLanguage
  value: string
  wrap?: boolean
}) {
  const highlightKey = `${language}\u0000${value}`
  const [highlightResult, setHighlightResult] = React.useState({
    html: "",
    key: "",
  })

  React.useEffect(() => {
    let ignore = false

    void highlightRequestBody({ language, value })
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
  }, [highlightKey, language, value])

  const highlightedHtml =
    highlightResult.key === highlightKey ? highlightResult.html : ""

  return (
    <div className="relative h-[420px] overflow-auto rounded-md border bg-background sm:h-full">
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
            "min-w-0 overflow-x-auto p-4 text-xs leading-relaxed text-foreground",
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
  values,
}: {
  values: Record<string, string | string[]>
}) {
  const entries = Object.entries(values)

  if (entries.length === 0) {
    return <CodePanel value="None" />
  }

  return (
    <ScrollArea className="h-[420px] rounded-md border bg-background sm:h-full">
      <Table className="text-xs">
        <TableHeader className="bg-muted/35">
          <TableRow>
            <TableHead className="h-8 w-[11rem] text-[0.68rem] text-muted-foreground">
              KEY
            </TableHead>
            <TableHead className="h-8 text-[0.68rem] text-muted-foreground">
              VALUE
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(([key, value]) => (
            <TableRow key={key} className="hover:bg-muted/30">
              <TableCell className="w-[11rem] max-w-[11rem] truncate align-top text-xs text-muted-foreground">
                {key}
              </TableCell>
              <TableCell className="text-xs break-all whitespace-normal">
                {Array.isArray(value) ? value.join(", ") : value}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}
