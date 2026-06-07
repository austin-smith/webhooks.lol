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
      <section className="flex min-h-[420px] min-w-0 animate-in flex-col bg-card duration-200 fade-in-0 motion-reduce:animate-none sm:min-h-0">
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
    <section className="flex min-h-[520px] min-w-0 animate-in flex-col bg-card duration-200 fade-in-0 motion-reduce:animate-none sm:min-h-0">
      <RequestSummaryHeader request={request} />
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <RequestMetrics request={request} />

        <Separator className="my-3" />

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
    <header className="flex h-14 flex-col justify-center border-b bg-muted/20 px-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground">{description}</p>
    </header>
  )
}

function RequestSummaryHeader({ request }: { request: CapturedRequest }) {
  const path = formatRequestListPath(request)

  return (
    <header className="grid h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-muted/20 px-4">
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
    <div className={cn("min-w-0 px-3 py-1.5", className)}>
      <dt className="text-[0.68rem] text-muted-foreground">{label}</dt>
      <dd className="truncate text-xs">{value}</dd>
    </div>
  )
}

function RequestPayloadTabs({ request }: { request: CapturedRequest }) {
  const body = formatRequestBodyDisplay(request)
  const rawRequest = formatRawRequest(request)
  const [activeTab, setActiveTab] = React.useState("detail")
  const [wrap, setWrap] = React.useState(readStoredBodyWrap)
  const bodyCopy = useCopyAction(body.value)
  const rawCopy = useCopyAction(rawRequest)
  const hasQuery = Object.keys(request.query).length > 0

  const toggleWrap = React.useCallback(() => {
    setWrap((current) => {
      const next = !current

      try {
        window.localStorage.setItem(BODY_WRAP_STORAGE_KEY, String(next))
      } catch {
        // The setting still applies for the current session.
      }

      return next
    })
  }, [])

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="border-b pb-2">
        <TabsList
          variant="line"
          className="justify-start rounded-none [&_[data-slot=tabs-trigger]]:text-xs"
        >
          <TabsTrigger value="detail" className="flex-none px-3">
            Detail
          </TabsTrigger>
          <TabsTrigger value="raw" className="flex-none px-3">
            Raw
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent
        value="detail"
        className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
      >
        {hasQuery ? (
          <PayloadSection title="QUERY">
            <KeyValueTable values={request.query} />
          </PayloadSection>
        ) : null}
        <PayloadSection title="HEADERS">
          <KeyValueTable values={request.headers} />
        </PayloadSection>
        <PayloadSection title="BODY">
          <CodePanel
            actions={
              <div className="flex items-center gap-1">
                <WrapToggle
                  active={wrap}
                  onToggle={toggleWrap}
                  variant="outline"
                />
                <CopyButton
                  copied={bodyCopy.copied}
                  copiedLabel="Copied body"
                  disabled={!body.value}
                  label="Copy body"
                  onCopy={bodyCopy.copy}
                  variant="outline"
                />
              </div>
            }
            className="min-h-[12rem]"
            language={body.language}
            value={body.value || "No body"}
            wrap={wrap}
          />
        </PayloadSection>
      </TabsContent>
      <TabsContent value="raw" className="mt-3 min-h-0 flex-1">
        <CodePanel
          actions={
            <div className="flex items-center gap-1">
              <WrapToggle
                active={wrap}
                onToggle={toggleWrap}
                variant="outline"
              />
              <CopyButton
                copied={rawCopy.copied}
                copiedLabel="Copied request"
                disabled={!rawRequest}
                label="Copy request"
                onCopy={rawCopy.copy}
                variant="outline"
              />
            </div>
          }
          className="h-[420px] sm:h-full"
          value={rawRequest}
          wrap={wrap}
        />
      </TabsContent>
    </Tabs>
  )
}

function PayloadSection({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <section className="flex min-w-0 flex-col gap-1">
      <header className="flex h-6 items-center">
        <span className="text-[0.68rem] tracking-wide text-muted-foreground">
          {title}
        </span>
      </header>
      {children}
    </section>
  )
}

function WrapToggle({
  active,
  onToggle,
  variant = "ghost",
}: {
  active: boolean
  onToggle: () => void
  variant?: "ghost" | "outline"
}) {
  return (
    <InspectorIconButton
      aria-pressed={active}
      className={cn(
        "size-7 rounded-sm",
        variant === "outline" && "bg-background/95",
        active && "border-foreground/30 bg-muted text-foreground"
      )}
      icon={WrapTextIcon}
      label={active ? "Disable word wrap" : "Enable word wrap"}
      onClick={onToggle}
      size="icon-sm"
      variant={variant}
    />
  )
}

function CopyButton({
  copied,
  copiedLabel,
  disabled,
  label,
  onCopy,
  variant = "ghost",
}: {
  copied: boolean
  copiedLabel: string
  disabled?: boolean
  label: string
  onCopy: () => void
  variant?: "ghost" | "outline"
}) {
  return (
    <InspectorIconButton
      className={cn(
        "size-7 rounded-sm",
        variant === "outline" && "bg-background/95"
      )}
      disabled={disabled}
      icon={copied ? CheckIcon : CopyIcon}
      label={copied ? copiedLabel : label}
      onClick={onCopy}
      size="icon-sm"
      variant={variant}
    />
  )
}

function useCopyAction(value: string) {
  const [copiedValue, setCopiedValue] = React.useState<string | null>(null)
  const resetTimeout = React.useRef<number | null>(null)
  const copied = value !== "" && copiedValue === value

  React.useEffect(() => {
    return () => {
      if (resetTimeout.current) {
        window.clearTimeout(resetTimeout.current)
      }
    }
  }, [])

  const copy = React.useCallback(async () => {
    if (!value) {
      return
    }

    if (resetTimeout.current) {
      window.clearTimeout(resetTimeout.current)
    }

    try {
      await navigator.clipboard.writeText(value)
      setCopiedValue(value)
    } catch {
      setCopiedValue(null)
    }

    resetTimeout.current = window.setTimeout(() => {
      setCopiedValue((current) => (current === value ? null : current))
      resetTimeout.current = null
    }, 1400)
  }, [value])

  return { copied, copy }
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
