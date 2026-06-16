import * as React from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  Code2Icon,
  LoaderCircleIcon,
  Repeat2Icon,
  RefreshCwIcon,
  SquareTerminalIcon,
  TerminalIcon,
  Trash2Icon,
  WebhookIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { CapturedRequest } from "@webhooks-lol/webhooks-core/types"
import {
  requestSearchIsActive,
  type RequestSearchCriteria,
} from "@webhooks-lol/webhooks-core/request-search"
import { cn } from "@/lib/utils"

// Requests usually load faster than the eye registers, so a loading affordance
// that flashes for an instant reads as jank. Only surface it once a fetch has
// clearly outrun this threshold.
const LOADING_INDICATOR_DELAY_MS = 150

import { InspectorIconButton } from "./inspector-icon-button"
import { RequestMethodBadge } from "./request-method-badge"
import {
  RequestSearchButton,
  RequestSearchChips,
} from "./request-search-control"
import {
  formatRequestDate,
  formatRequestDateTime,
  formatRequestListPath,
  formatRequestTime,
} from "./request-formatters"
import { useRequestCopyAction } from "./use-request-copy-action"

type EndpointPanelProps = {
  canRefresh: boolean
  docsUrl: string | null
  hasMoreRequests: boolean
  isClearing: boolean
  isLoading: boolean
  isLoadingOlderRequests: boolean
  requestSearch: RequestSearchCriteria
  requests: CapturedRequest[]
  replayingRequestIds: ReadonlySet<string>
  selectedId: string | null
  webhookUrl: string
  onClearEndpoint: () => void
  onLoadOlderRequests: () => void
  onRefreshEndpoint: () => void
  onReplayRequest: (requestId: string) => Promise<void>
  onSearchRequests: (search: RequestSearchCriteria) => void
  onSelectRequest: (id: string) => void
}

export function EndpointPanel({
  canRefresh,
  docsUrl,
  hasMoreRequests,
  isClearing,
  isLoading,
  isLoadingOlderRequests,
  requestSearch,
  requests,
  replayingRequestIds,
  selectedId,
  webhookUrl,
  onClearEndpoint,
  onLoadOlderRequests,
  onRefreshEndpoint,
  onReplayRequest,
  onSearchRequests,
  onSelectRequest,
}: EndpointPanelProps) {
  const showLoadingIndicator = useDelayedFlag(
    isLoading,
    LOADING_INDICATOR_DELAY_MS
  )
  const hasActiveSearch = requestSearchIsActive(requestSearch)

  return (
    <section className="flex h-[min(42svh,28rem)] min-h-[220px] min-w-0 flex-col overflow-hidden border-b bg-card sm:h-auto sm:min-h-0 sm:border-r sm:border-b-0">
      <header className="border-b bg-muted/20">
        <div className="grid h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">REQUESTS</h2>
            <div className="min-h-4 text-[0.68rem] text-muted-foreground">
              {isLoading ? null : (
                <span className="animate-in duration-200 fade-in-0 motion-reduce:animate-none">
                  {requests.length} shown
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <RequestSearchButton
              docsUrl={docsUrl}
              disabled={!canRefresh}
              search={requestSearch}
              onSearch={onSearchRequests}
            />
            <InspectorIconButton
              label="Refresh"
              disabled={!canRefresh}
              onClick={onRefreshEndpoint}
              icon={RefreshCwIcon}
              variant="ghost"
            />
            <InspectorIconButton
              label="Clear"
              disabled={!canRefresh || isClearing}
              onClick={onClearEndpoint}
              icon={Trash2Icon}
              variant="ghost"
            />
          </div>
        </div>
        {hasActiveSearch ? (
          <div className="border-t px-4 py-2">
            <RequestSearchChips
              className="mt-0"
              disabled={!canRefresh}
              search={requestSearch}
              onSearch={onSearchRequests}
            />
          </div>
        ) : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
        {isLoading ? (
          showLoadingIndicator ? (
            <RequestListLoading />
          ) : null
        ) : requests.length > 0 ? (
          <ScrollArea
            className="min-h-0 flex-1"
            aria-busy={isLoadingOlderRequests}
          >
            <ul
              aria-label="Captured requests"
              className="flex flex-col gap-2 pr-3"
            >
              {requests.map((request) => (
                <li
                  key={request.id}
                  className="animate-in duration-200 ease-out fade-in-0 slide-in-from-top-1 motion-reduce:animate-none"
                >
                  <RequestListItem
                    isReplaying={replayingRequestIds.has(request.id)}
                    request={request}
                    selected={request.id === selectedId}
                    webhookUrl={webhookUrl}
                    onReplayRequest={onReplayRequest}
                    onSelect={() => onSelectRequest(request.id)}
                  />
                </li>
              ))}
            </ul>
            {hasMoreRequests || isLoadingOlderRequests ? (
              <div className="sticky bottom-0 mt-3 bg-gradient-to-t from-card via-card pt-3 pr-3 pb-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full rounded-sm text-[0.68rem]"
                  disabled={!hasMoreRequests || isLoadingOlderRequests}
                  onClick={onLoadOlderRequests}
                >
                  {isLoadingOlderRequests ? (
                    <LoaderCircleIcon
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : (
                    <ChevronDownIcon data-icon="inline-start" />
                  )}
                  {isLoadingOlderRequests ? "Loading older" : "Load older"}
                </Button>
              </div>
            ) : null}
          </ScrollArea>
        ) : (
          <Empty className="h-full animate-in rounded-sm border border-dashed bg-background/60 p-4 duration-200 fade-in-0 motion-reduce:animate-none">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="rounded-sm">
                <WebhookIcon />
              </EmptyMedia>
              <EmptyTitle>
                {hasActiveSearch ? "NO MATCHES" : "NO REQUESTS"}
              </EmptyTitle>
              <EmptyDescription className="text-xs">
                {hasActiveSearch ? "FILTERED" : "WAITING"}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </section>
  )
}

function RequestListItem({
  isReplaying,
  onReplayRequest,
  request,
  selected,
  onSelect,
  webhookUrl,
}: {
  isReplaying: boolean
  onReplayRequest: (requestId: string) => Promise<void>
  request: CapturedRequest
  selected: boolean
  onSelect: () => void
  webhookUrl: string
}) {
  const path = formatRequestListPath(request)
  const receivedDate = formatRequestDate(request.receivedAt)
  const receivedAt = formatRequestDateTime(request.receivedAt)
  const receivedTime = formatRequestTime(request.receivedAt)
  const { canCopy, copiedFormat, copyFormat, statusMessage } =
    useRequestCopyAction({ request, webhookUrl })
  const replayRequest = React.useCallback(async () => {
    try {
      await onReplayRequest(request.id)
    } catch {
      return
    }
  }, [onReplayRequest, request.id])

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) {
          onSelect()
        }
      }}
    >
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={onSelect}
          aria-current={selected ? "true" : undefined}
          aria-label={`${request.method} ${path} received at ${receivedAt}`}
          className={cn(
            "grid h-12 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-md border bg-background px-3 text-left transition-colors hover:border-foreground/20 hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:outline-none aria-current:border-foreground/35 aria-current:bg-muted/35 data-[state=open]:border-foreground/35 data-[state=open]:bg-muted/35",
            selected && "border-foreground/35 bg-muted/35"
          )}
        >
          <RequestMethodBadge method={request.method} />
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium text-foreground">
              {path}
            </span>
          </span>
          <time
            dateTime={request.receivedAt}
            title={receivedAt}
            className="flex shrink-0 flex-col items-end gap-0.5 text-[0.65rem] leading-none whitespace-nowrap text-muted-foreground"
          >
            <span>{receivedDate}</span>
            <span className="text-muted-foreground/80 tabular-nums">
              {receivedTime}
            </span>
          </time>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-40">
        <ContextMenuLabel>Request actions</ContextMenuLabel>
        <ContextMenuGroup>
          <ContextMenuItem
            disabled={!canCopy}
            onSelect={() => {
              void copyFormat("curl")
            }}
          >
            {copiedFormat === "curl" ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <TerminalIcon data-icon="inline-start" />
            )}
            {copiedFormat === "curl" ? "Copied cURL" : "Copy as cURL"}
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!canCopy}
            onSelect={() => {
              void copyFormat("fetch")
            }}
          >
            {copiedFormat === "fetch" ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <Code2Icon data-icon="inline-start" />
            )}
            {copiedFormat === "fetch" ? "Copied Fetch" : "Copy as Fetch"}
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!canCopy}
            onSelect={() => {
              void copyFormat("cli")
            }}
          >
            {copiedFormat === "cli" ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <SquareTerminalIcon data-icon="inline-start" />
            )}
            {copiedFormat === "cli"
              ? "Copied CLI command"
              : "Copy as CLI command"}
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem
            disabled={isReplaying}
            onSelect={() => {
              void replayRequest()
            }}
          >
            {isReplaying ? (
              <LoaderCircleIcon
                data-icon="inline-start"
                className="animate-spin"
              />
            ) : (
              <Repeat2Icon data-icon="inline-start" />
            )}
            {isReplaying ? "Replaying" : "Replay request"}
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
      <span className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </span>
    </ContextMenu>
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
