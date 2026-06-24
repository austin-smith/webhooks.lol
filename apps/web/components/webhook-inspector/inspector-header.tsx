"use client"

import { CheckIcon, CopyIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
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
  EndpointAccountStatus,
  EndpointStats,
} from "./endpoint-session/transport"
import { formatConnectionState } from "./request-formatters"

type InspectorHeaderProps = {
  connectionState: ConnectionState
  copied: boolean
  copyMessage: string
  docsUrl: string | null
  endpointAccountStatuses: Record<string, EndpointAccountStatus>
  endpointNames: Record<string, string>
  forwardTargets: EndpointForwardTarget[]
  isLoading: boolean
  isLoadingForwardTargets: boolean
  isSavingEndpointToAccount: boolean
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
  onLoadEndpointAccountStatus: (
    endpointId?: string
  ) => Promise<EndpointAccountStatus | null>
  onLoadForwardTargets: () => Promise<void>
  onLoadEndpointStats: () => Promise<EndpointStats | null>
  onNewEndpoint: () => void
  onRenameEndpoint: (name: string) => void
  onResetResponseOverride: () => Promise<void>
  onSaveEndpointToAccount: (
    endpointId?: string
  ) => Promise<EndpointAccountStatus | null>
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
  endpointAccountStatuses,
  endpointNames,
  forwardTargets,
  isLoading,
  isLoadingForwardTargets,
  isSavingEndpointToAccount,
  isSavingForwardTarget,
  isSavingResponse,
  onCreateForwardTarget,
  onDeleteForwardTarget,
  onLoadEndpointAccountStatus,
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
  onSaveEndpointToAccount,
  onSwitchEndpoint,
  onUpdateForwardTarget,
}: InspectorHeaderProps) {
  const endpointName = endpointId ? (endpointNames[endpointId] ?? "") : ""

  return (
    <header className="min-w-0">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] overflow-hidden rounded-md border bg-card sm:grid-cols-[minmax(7.5rem,12rem)_minmax(0,1fr)_auto]">
        <EndpointSwitcher
          disabled={isLoading || !endpointId}
          endpointAccountStatuses={endpointAccountStatuses}
          endpointNames={endpointNames}
          isSavingEndpointToAccount={isSavingEndpointToAccount}
          name={endpointName}
          recentEndpointIds={recentEndpointIds}
          endpointId={endpointId}
          onLoadEndpointAccountStatus={onLoadEndpointAccountStatus}
          onNewEndpoint={onNewEndpoint}
          onRenameEndpoint={onRenameEndpoint}
          onSaveEndpointToAccount={onSaveEndpointToAccount}
          onSwitchEndpoint={onSwitchEndpoint}
        />

        <div className="col-span-2 row-start-2 flex min-w-0 items-center gap-1 border-t pr-1 pl-2 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:border-t-0 sm:border-l">
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

        <div className="col-start-2 row-start-1 flex items-center gap-0.5 border-l p-1 sm:col-start-3">
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
          <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />
          <ConnectionStatus state={connectionState} />
        </div>
      </div>
    </header>
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
