"use client"

import * as React from "react"
import { InfoIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { EndpointStats } from "@/components/webhook-inspector/endpoint-session/transport"

import {
  formatBytes,
  formatEndpointDetailDateTime,
  formatRelativeTime,
  formatShortEndpointId,
} from "./request-formatters"

type EndpointDetailsPopoverProps = {
  disabled: boolean
  endpointId: string | null
  name: string
  onLoadEndpointStats: () => Promise<EndpointStats | null>
}

export function EndpointDetailsPopover({
  disabled,
  endpointId,
  name,
  onLoadEndpointStats,
}: EndpointDetailsPopoverProps) {
  const [open, setOpen] = React.useState(false)
  const [stats, setStats] = React.useState<EndpointStats | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [hasError, setHasError] = React.useState(false)
  const loadVersion = React.useRef(0)

  const loadDetails = React.useCallback(async () => {
    if (!endpointId) {
      return
    }

    const version = loadVersion.current + 1
    loadVersion.current = version

    setIsLoading(true)
    setHasError(false)

    try {
      const nextStats = await onLoadEndpointStats()

      if (loadVersion.current !== version) {
        return
      }

      setStats(nextStats)
      setIsLoading(false)
    } catch {
      if (loadVersion.current !== version) {
        return
      }

      setStats(null)
      setHasError(true)
      setIsLoading(false)
    }
  }, [endpointId, onLoadEndpointStats])

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)

    if (nextOpen) {
      void loadDetails()
      return
    }

    loadVersion.current += 1
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-sm"
              disabled={disabled}
              aria-label="Endpoint details"
            >
              <InfoIcon data-icon="inline-start" />
              <span className="sr-only">Endpoint details</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Endpoint details</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        className="w-[min(18rem,calc(100vw-2rem))] p-0"
      >
        <EndpointDetailsTitle name={name} endpointId={endpointId} />
        {isLoading ? (
          <EndpointDetailsLoading />
        ) : hasError || !stats ? (
          <div className="px-3 py-3 text-xs text-muted-foreground">-</div>
        ) : (
          <EndpointDetails stats={stats} />
        )}
      </PopoverContent>
    </Popover>
  )
}

function EndpointDetailsTitle({
  name,
  endpointId,
}: {
  name: string
  endpointId: string | null
}) {
  const label = name.trim()
  const shortId = formatShortEndpointId(endpointId)

  return (
    <div className="border-b bg-muted/50 px-3 py-2">
      <div className="text-xs font-semibold">ENDPOINT</div>
      <div className="truncate text-[0.65rem] text-muted-foreground">
        {label ? (
          <>
            {label}
            <span className="font-mono"> · {shortId}</span>
          </>
        ) : (
          <span className="font-mono">{shortId}</span>
        )}
      </div>
    </div>
  )
}

function EndpointDetails({ stats }: { stats: EndpointStats }) {
  return (
    <dl className="grid grid-cols-[6.75rem_minmax(0,1fr)] text-[0.65rem]">
      <EndpointDetail
        label="Total requests"
        value={stats.requestCount.toString()}
      />
      <EndpointDetail
        label="Total size"
        value={formatBytes(stats.bodySizeBytes)}
      />
      <EndpointDetail
        label="Created"
        value={<TimestampValue value={stats.createdAt} />}
      />
      <EndpointDetail
        label="Last activity"
        value={<TimestampValue value={stats.lastActivityAt} />}
      />
    </dl>
  )
}

function TimestampValue({ value }: { value: string }) {
  return (
    <span className="flex flex-col items-end gap-0.5">
      <span>{formatEndpointDetailDateTime(value)}</span>
      <span className="text-[0.6rem] text-muted-foreground/80">
        {formatRelativeTime(value)}
      </span>
    </span>
  )
}

function EndpointDetail({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <>
      <dt className="border-b px-2.5 py-2 whitespace-nowrap text-muted-foreground last:border-b-0">
        {label}
      </dt>
      <dd className="min-w-0 border-b px-2.5 py-2 text-right whitespace-nowrap tabular-nums last:border-b-0">
        {value}
      </dd>
    </>
  )
}

function EndpointDetailsLoading() {
  return (
    <div className="grid grid-cols-[6.75rem_minmax(0,1fr)]">
      {Array.from({ length: 4 }).map((_, index) => (
        <React.Fragment key={index}>
          <div className="border-b px-3 py-2">
            <Skeleton className="h-3 w-16 rounded-sm" />
          </div>
          <div className="border-b px-3 py-2">
            <Skeleton className="ml-auto h-3 w-20 rounded-sm" />
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}
