import { BracesIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { CapturedRequest } from "@/lib/webhook-types"
import { cn } from "@/lib/utils"

import { CodePanel, KeyValueTable } from "./request-data-panels"
import {
  formatRawRequest,
  formatRequestBody,
  formatRequestDateTime,
  formatRequestDetailPath,
  getMethodBadgeVariant,
} from "./request-formatters"

export function RequestDetail({
  request,
}: {
  request: CapturedRequest | null
}) {
  if (!request) {
    return (
      <section className="flex min-h-[420px] min-w-0 flex-col bg-card sm:min-h-0">
        <RequestDetailHeader title="REQUEST" description="No selection" />
        <div className="flex min-h-0 flex-1 p-4">
          <Empty className="h-full rounded-none p-4">
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
    <section className="flex min-h-[520px] min-w-0 flex-col bg-card sm:min-h-0">
      <RequestSummaryHeader request={request} />
      <div className="flex min-h-0 flex-1 flex-col p-4">
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
    <header className="flex h-16 flex-col justify-center border-b px-4">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="text-xs text-muted-foreground">{description}</p>
    </header>
  )
}

function RequestSummaryHeader({ request }: { request: CapturedRequest }) {
  const path = formatRequestDetailPath(request)

  return (
    <header className="flex h-16 flex-col justify-center border-b px-4">
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <Badge
          variant={getMethodBadgeVariant(request.method)}
          className="rounded-sm px-1.5"
        >
          {request.method}
        </Badge>
        {path ? (
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {path}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {formatRequestDateTime(request.receivedAt)}
      </p>
    </header>
  )
}

function RequestMetrics({ request }: { request: CapturedRequest }) {
  return (
    <dl className="grid overflow-hidden rounded-md border bg-background md:grid-cols-3">
      <RequestMetric
        label="CONTENT TYPE"
        value={request.contentType ?? "none"}
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
  const formattedBody = formatRequestBody(request)
  const rawRequest = formatRawRequest(request)

  return (
    <Tabs defaultValue="body" className="flex min-h-0 flex-1 flex-col">
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
      <TabsContent value="body" className="min-h-0 flex-1">
        <CodePanel value={formattedBody || "No body"} />
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
