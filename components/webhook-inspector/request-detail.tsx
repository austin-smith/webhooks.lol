import * as React from "react"
import { BracesIcon, CheckIcon, CopyIcon, WrapTextIcon } from "lucide-react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { CapturedRequest } from "@/lib/webhooks/types"
import { cn } from "@/lib/utils"

import { InspectorIconButton } from "./inspector-icon-button"
import { CodePanel, KeyValueTable } from "./request-data-panels"
import { RequestMethodBadge } from "./request-method-badge"
import {
  formatBytes,
  formatRawRequest,
  formatRequestBodyDisplay,
  formatRequestDateTime,
  formatRequestListPath,
} from "./request-formatters"

const BODY_WRAP_STORAGE_KEY = "webhooks.lol:body-wrap"

export function RequestDetail({
  request,
}: {
  request: CapturedRequest | null
}) {
  if (!request) {
    return (
      <section className="flex min-h-[420px] min-w-0 flex-col bg-card duration-200 animate-in fade-in-0 sm:min-h-0 motion-reduce:animate-none">
        <RequestDetailHeader title="REQUEST" description="No selection" />
        <div className="flex min-h-0 flex-1 p-3 sm:p-4">
          <Empty className="h-full rounded-sm border border-dashed bg-background/60 p-4">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="rounded-sm">
                <BracesIcon />
              </EmptyMedia>
              <EmptyTitle>NOTHING CAPTURED</EmptyTitle>
              <EmptyDescription className="text-xs">WAITING</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </section>
    )
  }

  return (
    <section className="flex min-h-[520px] min-w-0 flex-col bg-card duration-200 animate-in fade-in-0 sm:min-h-0 motion-reduce:animate-none">
      <RequestSummaryHeader request={request} />
      <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
        <RequestMetrics request={request} />

        <Separator className="my-4" />

        <RequestPayloadTabs request={request} />
      </div>
    </section>
  )
}

function RequestDetailHeader({
  description,
  title,
}: {
  description: string
  title: string
}) {
  return (
    <header className="flex h-16 flex-col justify-center border-b bg-muted/20 px-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground">{description}</p>
    </header>
  )
}

function RequestSummaryHeader({ request }: { request: CapturedRequest }) {
  const path = formatRequestListPath(request)

  return (
    <header className="grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-muted/20 px-4">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <RequestMethodBadge method={request.method} />
          <span className="min-w-0 truncate text-xs text-foreground">
            {path}
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {formatRequestDateTime(request.receivedAt)}
        </p>
      </div>
      {request.ip ? (
        <span className="hidden max-w-40 truncate text-[0.68rem] text-muted-foreground md:inline-flex">
          {request.ip}
        </span>
      ) : null}
    </header>
  )
}

function RequestMetrics({ request }: { request: CapturedRequest }) {
  return (
    <dl className="grid overflow-hidden rounded-md border bg-background md:grid-cols-4">
      <RequestMetric
        label="CONTENT TYPE"
        value={request.contentType ?? "none"}
        className="border-b md:border-r md:border-b-0"
      />
      <RequestMetric
        label="BODY"
        value={formatBytes(request.bodySize)}
        className="border-b md:border-r md:border-b-0"
      />
      <RequestMetric
        label="QUERY"
        value={String(Object.keys(request.query).length)}
        className="border-b md:border-r md:border-b-0"
      />
      <RequestMetric
        label="HEADERS"
        value={String(Object.keys(request.headers).length)}
      />
    </dl>
  )
}

function RequestMetric({
  className,
  label,
  value,
}: {
  className?: string
  label: string
  value: string
}) {
  return (
    <div className={cn("min-w-0 px-3 py-2", className)}>
      <dt className="text-[0.68rem] text-muted-foreground">{label}</dt>
      <dd className="truncate text-xs">{value}</dd>
    </div>
  )
}

function RequestPayloadTabs({ request }: { request: CapturedRequest }) {
  const body = formatRequestBodyDisplay(request)
  const rawRequest = formatRawRequest(request)
  const bodyCopyKey = `${request.id}\u0000${body.value}`
  const [activeTab, setActiveTab] = React.useState("body")
  const [copiedBodyKey, setCopiedBodyKey] = React.useState<string | null>(null)
  const [wrapBody, setWrapBody] = React.useState(readStoredBodyWrap)
  const copyBodyResetTimeout = React.useRef<number | null>(null)
  const copiedBody = copiedBodyKey === bodyCopyKey

  React.useEffect(() => {
    return () => {
      if (copyBodyResetTimeout.current) {
        window.clearTimeout(copyBodyResetTimeout.current)
      }
    }
  }, [])

  const toggleWrapBody = React.useCallback(() => {
    setWrapBody((current) => {
      const next = !current

      try {
        window.localStorage.setItem(BODY_WRAP_STORAGE_KEY, String(next))
      } catch {
        // The setting still applies for the current session.
      }

      return next
    })
  }, [])

  const copyBody = React.useCallback(async () => {
    if (!body.value) {
      return
    }

    if (copyBodyResetTimeout.current) {
      window.clearTimeout(copyBodyResetTimeout.current)
    }

    try {
      await navigator.clipboard.writeText(body.value)
      setCopiedBodyKey(bodyCopyKey)
    } catch {
      setCopiedBodyKey(null)
    }

    copyBodyResetTimeout.current = window.setTimeout(() => {
      setCopiedBodyKey((current) =>
        current === bodyCopyKey ? null : current
      )
      copyBodyResetTimeout.current = null
    }, 1400)
  }, [body.value, bodyCopyKey])

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex items-center justify-between gap-3 border-b pb-2">
        <TabsList
          variant="line"
          className="justify-start rounded-none [&_[data-slot=tabs-trigger]]:text-xs"
        >
          <TabsTrigger value="body" className="flex-none px-3">
            Body
          </TabsTrigger>
          <TabsTrigger value="headers" className="flex-none px-3">
            Headers
          </TabsTrigger>
          <TabsTrigger value="query" className="flex-none px-3">
            Query
          </TabsTrigger>
          <TabsTrigger value="raw" className="flex-none px-3">
            Raw
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center">
          <InspectorIconButton
            aria-pressed={wrapBody}
            className={cn(
              "size-7 rounded-sm",
              wrapBody && "border-foreground/30 bg-muted text-foreground"
            )}
            disabled={activeTab !== "body"}
            icon={WrapTextIcon}
            label={wrapBody ? "Disable word wrap" : "Enable word wrap"}
            onClick={toggleWrapBody}
            size="icon-sm"
            variant="ghost"
          />
        </div>
      </div>
      <TabsContent value="body" className="min-h-0 flex-1">
        <CodePanel
          actions={
            <InspectorIconButton
              className="size-7 rounded-sm bg-background/95"
              disabled={!body.value}
              icon={copiedBody ? CheckIcon : CopyIcon}
              label={copiedBody ? "Copied body" : "Copy body"}
              onClick={copyBody}
              size="icon-sm"
              variant="outline"
            />
          }
          language={body.language}
          value={body.value || "No body"}
          wrap={wrapBody}
        />
      </TabsContent>
      <TabsContent value="headers" className="min-h-0 flex-1">
        <KeyValueTable values={request.headers} />
      </TabsContent>
      <TabsContent value="query" className="min-h-0 flex-1">
        <KeyValueTable values={request.query} />
      </TabsContent>
      <TabsContent value="raw" className="min-h-0 flex-1">
        <CodePanel value={rawRequest} />
      </TabsContent>
    </Tabs>
  )
}

function readStoredBodyWrap() {
  if (typeof window === "undefined") {
    return false
  }

  try {
    return window.localStorage.getItem(BODY_WRAP_STORAGE_KEY) === "true"
  } catch {
    return false
  }
}
