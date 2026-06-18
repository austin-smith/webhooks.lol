"use client"

import Image from "next/image"
import type { ComponentType, SVGProps } from "react"
import { BookTextIcon, CheckIcon, CopyIcon } from "lucide-react"

import { GithubIcon } from "@/components/icons/github-icon"
import { ThemeSwitcher } from "@/components/theme/theme-switcher"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  EndpointResponseConfig,
  EndpointResponseOverrideInput,
} from "@webhooks-lol/webhooks-core/endpoint-response"
import { cn } from "@/lib/utils"

import { EndpointSwitcher } from "./endpoint-switcher"
import { EndpointDetailsPopover } from "./endpoint-details-popover"
import { EndpointForwardingControl } from "./endpoint-forwarding-control"
import { InspectorIconButton } from "./inspector-icon-button"
import { ResponseOverrideControl } from "./response-override-control"
import type { ConnectionState, EndpointForwardPathMode } from "./types"
import type {
  EndpointForwardTarget,
  EndpointStats,
} from "./endpoint-session/transport"
import { formatConnectionState } from "./request-formatters"

const GITHUB_URL = "https://github.com/austin-smith/webhooks.lol"

type InspectorHeaderProps = {
  connectionState: ConnectionState
  copied: boolean
  copyMessage: string
  docsUrl: string | null
  endpointNames: Record<string, string>
  forwardTargets: EndpointForwardTarget[]
  isLoading: boolean
  isLoadingForwardTargets: boolean
  isSavingForwardTarget: boolean
  isSavingResponse: boolean
  recentEndpointIds: string[]
  responseConfig: EndpointResponseConfig
  endpointId: string | null
  webhookUrl: string
  onCreateForwardTarget: (target: {
    pathMode?: EndpointForwardPathMode
    url: string
  }) => Promise<void>
  onCopyWebhookUrl: () => void
  onDeleteForwardTarget: (targetId: string) => Promise<void>
  onLoadForwardTargets: () => Promise<void>
  onLoadEndpointStats: () => Promise<EndpointStats | null>
  onNewEndpoint: () => void
  onRenameEndpoint: (name: string) => void
  onResetResponseOverride: () => Promise<void>
  onSaveResponseOverride: (
    override: EndpointResponseOverrideInput
  ) => Promise<void>
  onSwitchEndpoint: (endpointId: string) => void
  onUpdateForwardTarget: (
    targetId: string,
    target: {
      enabled?: boolean
      pathMode?: EndpointForwardPathMode
      url?: string
    }
  ) => Promise<void>
}

export function InspectorHeader({
  connectionState,
  copied,
  copyMessage,
  docsUrl,
  endpointNames,
  forwardTargets,
  isLoading,
  isLoadingForwardTargets,
  isSavingForwardTarget,
  isSavingResponse,
  onCreateForwardTarget,
  onDeleteForwardTarget,
  onResetResponseOverride,
  onLoadForwardTargets,
  onSaveResponseOverride,
  recentEndpointIds,
  responseConfig,
  endpointId,
  webhookUrl,
  onCopyWebhookUrl,
  onLoadEndpointStats,
  onNewEndpoint,
  onRenameEndpoint,
  onSwitchEndpoint,
  onUpdateForwardTarget,
}: InspectorHeaderProps) {
  const endpointName = endpointId ? (endpointNames[endpointId] ?? "") : ""

  return (
    <header className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-5 shrink-0 items-center justify-center">
            <Image
              src="/icon.png"
              alt=""
              width={20}
              height={20}
              aria-hidden="true"
              className="size-5"
              priority
            />
          </div>
          <h1 className="font-heading text-sm font-semibold tracking-tight text-foreground">
            WEBHOOKS<span className="text-brand">.LOL</span>
          </h1>
        </div>
        <nav
          aria-label="Resources"
          className="flex shrink-0 items-center gap-0.5"
        >
          {docsUrl ? (
            <HeaderLink href={docsUrl} icon={BookTextIcon} label="DOCS" />
          ) : null}
          <HeaderLink href={GITHUB_URL} icon={GithubIcon} label="GITHUB" />
          <ThemeSwitcher />
          <span aria-hidden="true" className="mx-1 h-3.5 w-px bg-border" />
          <ConnectionStatus state={connectionState} />
        </nav>
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(6.75rem,8.5rem)_minmax(0,1fr)_auto] overflow-hidden rounded-md border bg-card sm:grid-cols-[minmax(7.5rem,12rem)_minmax(0,1fr)_auto]">
        <EndpointSwitcher
          disabled={isLoading || !endpointId}
          endpointNames={endpointNames}
          name={endpointName}
          recentEndpointIds={recentEndpointIds}
          endpointId={endpointId}
          onNewEndpoint={onNewEndpoint}
          onRenameEndpoint={onRenameEndpoint}
          onSwitchEndpoint={onSwitchEndpoint}
        />

        <div className="flex min-w-0 items-center gap-1 border-l pr-1 pl-2">
          {webhookUrl ? (
            <Input
              readOnly
              density="compact"
              variant="embedded"
              value={webhookUrl}
              aria-label="Receive URL"
              className="h-10 min-w-0 flex-1 animate-in px-0 font-mono text-xs text-foreground duration-200 fade-in-0 motion-reduce:animate-none"
            />
          ) : (
            <div className="flex h-10 min-w-0 flex-1 items-center">
              <Skeleton
                className="h-3 w-44 max-w-full rounded-sm"
                aria-hidden="true"
              />
              <span className="sr-only" role="status">
                Preparing webhook URL
              </span>
            </div>
          )}
          <InspectorIconButton
            label={copied ? "Copied URL" : "Copy URL"}
            disabled={!webhookUrl}
            onClick={onCopyWebhookUrl}
            icon={copied ? CheckIcon : CopyIcon}
            className="rounded-sm"
            size="icon-sm"
            variant="ghost"
          />
          <span className="sr-only" role="status" aria-live="polite">
            {copyMessage}
          </span>
        </div>

        <div className="flex items-center gap-0.5 border-l p-1">
          <EndpointDetailsPopover
            disabled={isLoading || !endpointId}
            endpointId={endpointId}
            name={endpointName}
            onLoadEndpointStats={onLoadEndpointStats}
          />
          <EndpointForwardingControl
            disabled={isLoading || !endpointId}
            docsUrl={docsUrl}
            isLoading={isLoadingForwardTargets}
            isSaving={isSavingForwardTarget}
            targets={forwardTargets}
            onCreateTarget={onCreateForwardTarget}
            onDeleteTarget={onDeleteForwardTarget}
            onLoadTargets={onLoadForwardTargets}
            onUpdateTarget={onUpdateForwardTarget}
          />
          <ResponseOverrideControl
            disabled={isLoading || !endpointId}
            docsUrl={docsUrl}
            isSaving={isSavingResponse}
            responseConfig={responseConfig}
            onReset={onResetResponseOverride}
            onSave={onSaveResponseOverride}
          />
        </div>
      </div>
    </header>
  )
}

function HeaderLink({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
}) {
  const link = (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[0.68rem] font-medium tracking-wide text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:hover:bg-muted/50"
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </a>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent className="sm:hidden">{label}</TooltipContent>
    </Tooltip>
  )
}

const connectionDotStyles: Record<ConnectionState, string> = {
  live: "bg-status-live",
  connecting: "bg-status-connecting",
  offline: "bg-status-offline",
}

function ConnectionStatus({ state }: { state: ConnectionState }) {
  return (
    <div
      role="status"
      aria-label={`Connection ${state}`}
      title="Connection state"
      className="inline-flex h-7 shrink-0 items-center gap-1.5 px-1 text-[0.68rem] font-medium tracking-wide text-muted-foreground"
    >
      <span
        className={cn(
          "inline-flex size-1.5 rounded-full",
          connectionDotStyles[state]
        )}
        aria-hidden="true"
      />
      {formatConnectionState(state)}
    </div>
  )
}
