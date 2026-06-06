"use client"

import Image from "next/image"
import { CheckIcon, CopyIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  InboxResponseConfig,
  InboxResponseOverrideInput,
} from "@/lib/webhooks/inbox-response"
import { cn } from "@/lib/utils"

import { InboxSwitcher } from "./inbox-switcher"
import { InspectorIconButton } from "./inspector-icon-button"
import { ResponseOverrideControl } from "./response-override-control"
import type { ConnectionState } from "./types"
import { formatConnectionState } from "./request-formatters"

type InspectorHeaderProps = {
  connectionState: ConnectionState
  copied: boolean
  copyMessage: string
  inboxNames: Record<string, string>
  isLoading: boolean
  isSavingResponse: boolean
  recentTokens: string[]
  responseConfig: InboxResponseConfig
  token: string | null
  webhookUrl: string
  onCopyWebhookUrl: () => void
  onNewInbox: () => void
  onRenameInbox: (name: string) => void
  onResetResponseOverride: () => Promise<void>
  onSaveResponseOverride: (
    override: InboxResponseOverrideInput
  ) => Promise<void>
  onSwitchInbox: (token: string) => void
}

export function InspectorHeader({
  connectionState,
  copied,
  copyMessage,
  inboxNames,
  isLoading,
  isSavingResponse,
  onResetResponseOverride,
  onSaveResponseOverride,
  recentTokens,
  responseConfig,
  token,
  webhookUrl,
  onCopyWebhookUrl,
  onNewInbox,
  onRenameInbox,
  onSwitchInbox,
}: InspectorHeaderProps) {
  const inboxName = token ? (inboxNames[token] ?? "") : ""

  return (
    <header className="flex min-w-0 flex-col gap-3 border-b pb-4">
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
          <h1 className="font-heading text-sm font-medium text-muted-foreground">
            WEBHOOKS.LOL
          </h1>
        </div>
        <ConnectionStatus state={connectionState} />
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(6.75rem,8.5rem)_minmax(0,1fr)_auto] overflow-hidden rounded-md border bg-card sm:grid-cols-[minmax(7.5rem,12rem)_minmax(0,1fr)_auto]">
        <InboxSwitcher
          disabled={isLoading || !token}
          inboxNames={inboxNames}
          name={inboxName}
          recentTokens={recentTokens}
          token={token}
          onNewInbox={onNewInbox}
          onRenameInbox={onRenameInbox}
          onSwitchInbox={onSwitchInbox}
        />

        <div className="flex min-w-0 items-center gap-1 border-l pl-2 pr-1">
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

        <div className="flex items-center border-l p-1">
          <ResponseOverrideControl
            disabled={isLoading || !token}
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

function ConnectionStatus({ state }: { state: ConnectionState }) {
  return (
    <div
      className="inline-flex h-6 shrink-0 items-center gap-1.5 text-[0.68rem] font-medium text-muted-foreground"
      title="Connection state"
    >
      <span
        className={cn(
          "size-1.5 rounded-full transition-colors duration-500 ease-out",
          state === "live" && "bg-foreground",
          state === "connecting" && "bg-muted-foreground",
          state === "offline" && "bg-destructive"
        )}
        aria-hidden="true"
      />
      {formatConnectionState(state)}
    </div>
  )
}
