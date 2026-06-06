import * as React from "react"
import { RefreshCwIcon, Trash2Icon, WebhookIcon } from "lucide-react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { CapturedRequest } from "@/lib/webhooks/types"
import { cn } from "@/lib/utils"

// Requests usually load faster than the eye registers, so a loading affordance
// that flashes for an instant reads as jank. Only surface it once a fetch has
// clearly outrun this threshold.
const LOADING_INDICATOR_DELAY_MS = 150

import { InspectorIconButton } from "./inspector-icon-button"
import { RequestMethodBadge } from "./request-method-badge"
import { formatRequestListPath, formatRequestTime } from "./request-formatters"

type EndpointPanelProps = {
  canRefresh: boolean
  isClearing: boolean
  isLoading: boolean
  requests: CapturedRequest[]
  selectedId: string | null
  onClearEndpoint: () => void
  onRefreshEndpoint: () => void
  onSelectRequest: (id: string) => void
}

export function EndpointPanel({
  canRefresh,
  isClearing,
  isLoading,
  requests,
  selectedId,
  onClearEndpoint,
  onRefreshEndpoint,
  onSelectRequest,
}: EndpointPanelProps) {
  const showLoadingIndicator = useDelayedFlag(
    isLoading,
    LOADING_INDICATOR_DELAY_MS
  )

  return (
    <section className="flex min-h-[220px] min-w-0 flex-col border-b bg-card sm:min-h-0 sm:border-r sm:border-b-0">
      <header className="grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-muted/20 px-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">REQUESTS</h2>
          <div className="min-h-4 text-[0.68rem] text-muted-foreground">
            {isLoading ? null : (
              <span className="animate-in duration-200 fade-in-0 motion-reduce:animate-none">
                {requests.length} captured
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <InspectorIconButton
            label="Refresh"
            disabled={!canRefresh}
            onClick={onRefreshEndpoint}
            icon={RefreshCwIcon}
            variant="ghost"
          />
          <InspectorIconButton
            label="Clear"
            disabled={!canRefresh || isClearing || requests.length === 0}
            onClick={onClearEndpoint}
            icon={Trash2Icon}
            variant="ghost"
          />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
        {isLoading ? (
          showLoadingIndicator ? (
            <RequestListLoading />
          ) : null
        ) : requests.length > 0 ? (
          <ScrollArea className="h-full">
            <ul aria-label="Captured requests" className="flex flex-col gap-2">
              {requests.map((request) => (
                <li
                  key={request.id}
                  className="animate-in duration-200 ease-out fade-in-0 slide-in-from-top-1 motion-reduce:animate-none"
                >
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
          <Empty className="h-full animate-in rounded-sm border border-dashed bg-background/60 p-4 duration-200 fade-in-0 motion-reduce:animate-none">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="rounded-sm">
                <WebhookIcon />
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
      <RequestMethodBadge method={request.method} />
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

function RequestListLoading() {
  return (
    <div
      role="status"
      className="flex animate-in items-center gap-2 px-1 text-[0.68rem] text-muted-foreground duration-200 fade-in-0 motion-reduce:animate-none"
    >
      <span
        className="size-1.5 animate-pulse rounded-full bg-muted-foreground"
        aria-hidden="true"
      />
      Loading requests…
    </div>
  )
}

// Returns true only after `active` has stayed true for `delayMs`, and resets as
// soon as it goes false so each new load re-arms the delay from scratch.
function useDelayedFlag(active: boolean, delayMs: number) {
  const [elapsed, setElapsed] = React.useState(false)

  React.useEffect(() => {
    if (!active) {
      return
    }

    const timer = window.setTimeout(() => {
      setElapsed(true)
    }, delayMs)

    return () => {
      window.clearTimeout(timer)
      setElapsed(false)
    }
  }, [active, delayMs])

  return active && elapsed
}
