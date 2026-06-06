import { InboxIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import type { CapturedRequest } from "@/lib/webhooks/types"
import { cn } from "@/lib/utils"

import { InspectorIconButton } from "./inspector-icon-button"
import {
  formatRequestListPath,
  formatRequestTime,
  getMethodBadgeVariant,
} from "./request-formatters"

type InboxPanelProps = {
  canRefresh: boolean
  isClearing: boolean
  isLoading: boolean
  requests: CapturedRequest[]
  selectedId: string | null
  onClearInbox: () => void
  onRefreshInbox: () => void
  onSelectRequest: (id: string) => void
}

export function InboxPanel({
  canRefresh,
  isClearing,
  isLoading,
  requests,
  selectedId,
  onClearInbox,
  onRefreshInbox,
  onSelectRequest,
}: InboxPanelProps) {
  return (
    <section className="flex min-h-[220px] min-w-0 flex-col border-b bg-card sm:min-h-0 sm:border-r sm:border-b-0">
      <header className="grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-muted/20 px-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">REQUESTS</h2>
          <div className="text-[0.68rem] text-muted-foreground">
            {requests.length} captured
          </div>
        </div>
        <div className="flex items-center gap-1">
          <InspectorIconButton
            label="Refresh"
            disabled={!canRefresh}
            onClick={onRefreshInbox}
            icon={RefreshCwIcon}
            variant="ghost"
          />
          <InspectorIconButton
            label="Clear"
            disabled={!canRefresh || isClearing || requests.length === 0}
            onClick={onClearInbox}
            icon={Trash2Icon}
            variant="ghost"
          />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
        {isLoading ? (
          <RequestListSkeleton />
        ) : requests.length > 0 ? (
          <ScrollArea className="h-full">
            <ul aria-label="Captured requests" className="flex flex-col gap-2">
              {requests.map((request) => (
                <li key={request.id}>
                  <RequestListItem
                    request={request}
                    selected={request.id === selectedId}
                    onSelect={() => onSelectRequest(request.id)}
                  />
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : (
          <Empty className="h-full rounded-sm border border-dashed bg-background/60 p-4">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="rounded-sm">
                <InboxIcon />
              </EmptyMedia>
              <EmptyTitle>NO REQUESTS</EmptyTitle>
              <EmptyDescription className="text-xs">WAITING</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </section>
  )
}

function RequestListItem({
  request,
  selected,
  onSelect,
}: {
  request: CapturedRequest
  selected: boolean
  onSelect: () => void
}) {
  const path = formatRequestListPath(request)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      aria-label={`${request.method} ${path} received at ${formatRequestTime(request.receivedAt)}`}
      className={cn(
        "grid h-11 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-md border bg-background px-3 text-left transition-colors hover:border-foreground/20 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:outline-none aria-current:border-foreground/35 aria-current:bg-muted/35",
        selected && "border-foreground/35 bg-muted/35"
      )}
    >
      <Badge
        variant={getMethodBadgeVariant(request.method)}
        className="rounded-sm px-1.5 font-semibold"
      >
        {request.method}
      </Badge>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-foreground">
          {path}
        </span>
      </span>
      <span className="shrink-0 text-[0.68rem] text-muted-foreground">
        {formatRequestTime(request.receivedAt)}
      </span>
    </button>
  )
}

function RequestListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex h-11 items-center rounded-md border bg-background px-3"
        >
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  )
}
