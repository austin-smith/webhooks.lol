"use client"

import * as React from "react"
import { formatDistanceStrict } from "date-fns"

import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { AppBuildMetadata } from "@/lib/app-build-metadata"
import type { AppEnvironment } from "@/lib/app-environment"
import { cn } from "@/lib/utils"

type AppEnvironmentBadgeProps = {
  buildMetadata: AppBuildMetadata | null
  environment: AppEnvironment
}

const HOVER_OPEN_DELAY_MS = 200
const HOVER_CLOSE_DELAY_MS = 150

export function AppEnvironmentBadge({
  buildMetadata,
  environment,
}: AppEnvironmentBadgeProps) {
  const [open, setOpen] = React.useState(false)
  const openSource = React.useRef<"explicit" | "hover" | null>(null)
  const openTimer = React.useRef<number | null>(null)
  const closeTimer = React.useRef<number | null>(null)
  const closingFromHover = React.useRef(false)

  React.useEffect(() => clearTimers, [])

  if (environment.kind === "production") {
    return null
  }

  const invalid = environment.kind === "invalid"
  const label = invalid ? "ENV UNKNOWN" : environment.name.toUpperCase()
  const accessibleLabel = invalid
    ? "Application environment is not configured correctly"
    : `Application environment: ${environment.name}`
  const badgeClassName = cn(
    "max-w-28 sm:max-w-40",
    !invalid && "text-muted-foreground"
  )

  if (buildMetadata === null) {
    return (
      <Badge
        variant={invalid ? "destructive" : "outline"}
        className={badgeClassName}
      >
        <span className="truncate">{label}</span>
      </Badge>
    )
  }

  function clearTimers() {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current)
      openTimer.current = null
    }

    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  function openOnHover(event: React.PointerEvent) {
    if (event.pointerType === "touch" || openSource.current === "explicit") {
      return
    }

    clearTimers()
    openTimer.current = window.setTimeout(() => {
      openSource.current = "hover"
      setOpen(true)
    }, HOVER_OPEN_DELAY_MS)
  }

  function closeAfterHover() {
    clearTimers()

    if (openSource.current !== "hover") {
      return
    }

    closeTimer.current = window.setTimeout(() => {
      closingFromHover.current = true
      openSource.current = null
      setOpen(false)
    }, HOVER_CLOSE_DELAY_MS)
  }

  function changeOpen(nextOpen: boolean) {
    clearTimers()

    if (nextOpen) {
      openSource.current ??= "explicit"
    } else {
      closingFromHover.current = openSource.current === "hover"
      openSource.current = null
    }

    setOpen(nextOpen)
  }

  function pinHoveredPopover(event: React.MouseEvent) {
    if (open && openSource.current === "hover") {
      event.preventDefault()
      clearTimers()
      openSource.current = "explicit"
    }
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <Badge
        asChild
        variant={invalid ? "destructive" : "outline"}
        className={badgeClassName}
      >
        <PopoverTrigger
          type="button"
          aria-label={`${accessibleLabel}. Show build details`}
          onClick={pinHoveredPopover}
          onPointerEnter={openOnHover}
          onPointerLeave={closeAfterHover}
        >
          <span className="truncate">{label}</span>
        </PopoverTrigger>
      </Badge>
      <PopoverContent
        aria-label="Build details"
        align="start"
        sideOffset={8}
        collisionPadding={16}
        className="w-[min(23rem,calc(100vw-2rem))] p-3"
        onPointerEnter={clearTimers}
        onPointerLeave={closeAfterHover}
        onOpenAutoFocus={(event) => {
          if (openSource.current === "hover") {
            event.preventDefault()
          }
        }}
        onCloseAutoFocus={(event) => {
          if (closingFromHover.current) {
            event.preventDefault()
            closingFromHover.current = false
          }
        }}
      >
        <BuildDetails metadata={buildMetadata} />
      </PopoverContent>
    </Popover>
  )
}

function BuildDetails({ metadata }: { metadata: AppBuildMetadata }) {
  const builtAt = new Date(metadata.builtAt)
  const builtAtLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(builtAt)
  const relativeBuiltAt = formatDistanceStrict(builtAt, new Date(), {
    addSuffix: true,
  })

  return (
    <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs leading-5">
      <BuildDetail label="BRANCH" title={metadata.branch}>
        {metadata.branch}
      </BuildDetail>
      <BuildDetail label="COMMIT" title={metadata.commitSha}>
        {metadata.commitSha.slice(0, 8)}
        {metadata.dirty ? (
          <span className="text-muted-foreground"> (dirty)</span>
        ) : null}
      </BuildDetail>
      <BuildDetail label="MESSAGE" title={metadata.commitSubject}>
        {metadata.commitSubject}
      </BuildDetail>
      <BuildDetail label="BUILT" title={builtAtLabel}>
        <time dateTime={metadata.builtAt}>
          {builtAtLabel} · {relativeBuiltAt}
        </time>
      </BuildDetail>
    </dl>
  )
}

function BuildDetail({
  children,
  label,
  title,
}: {
  children: React.ReactNode
  label: string
  title: string
}) {
  return (
    <>
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate" title={title}>
        {children}
      </dd>
    </>
  )
}
