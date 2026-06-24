"use client"

import * as React from "react"
import { AlertCircleIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { EndpointPanel } from "./endpoint-panel"
import { useBrowserEndpointSession } from "./endpoint-session/use-browser-endpoint-session"
import { InspectorHeader } from "./inspector-header"
import { RequestDetail } from "./request-detail"
import { useBrowserOrigin } from "./use-browser-origin"

type WebhookInspectorProps = {
  docsUrl: string | null
}

export function WebhookInspector({ docsUrl }: WebhookInspectorProps) {
  const origin = useBrowserOrigin()
  const endpoint = useBrowserEndpointSession()
  const webhookUrl =
    endpoint.endpointId && origin
      ? `${origin}/api/hook/${endpoint.endpointId}`
      : ""
  const [copied, setCopied] = React.useState(false)
  const [copyMessage, setCopyMessage] = React.useState("")
  const copyResetTimeout = React.useRef<number | null>(null)

  React.useEffect(() => {
    return () => {
      if (copyResetTimeout.current) {
        window.clearTimeout(copyResetTimeout.current)
      }
    }
  }, [])

  const copyWebhookUrl = React.useCallback(async () => {
    if (!webhookUrl) {
      return
    }

    if (copyResetTimeout.current) {
      window.clearTimeout(copyResetTimeout.current)
    }

    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      setCopyMessage("Webhook URL copied")
    } catch {
      setCopied(false)
      setCopyMessage("Could not copy webhook URL")
    }

    copyResetTimeout.current = window.setTimeout(() => {
      setCopied(false)
      setCopyMessage("")
      copyResetTimeout.current = null
    }, 1400)
  }, [webhookUrl])

  return (
    <main className="flex min-h-0 flex-1 animate-in flex-col gap-4 p-4 duration-300 ease-out fade-in-0 motion-reduce:animate-none sm:overflow-hidden lg:p-5">
      <InspectorHeader
        connectionState={endpoint.connectionState}
        copied={copied}
        docsUrl={docsUrl}
        copyMessage={copyMessage}
        endpointAccountStatuses={endpoint.endpointAccountStatuses}
        endpointNames={endpoint.endpointNames}
        forwardTargets={endpoint.forwardTargets}
        isLoading={endpoint.isLoading}
        isLoadingForwardTargets={endpoint.isLoadingForwardTargets}
        isSavingEndpointToAccount={endpoint.isSavingEndpointToAccount}
        isSavingForwardTarget={endpoint.isSavingForwardTarget}
        isSavingResponse={endpoint.isSavingResponse}
        recentEndpointIds={endpoint.recentEndpointIds}
        responseConfig={endpoint.responseConfig}
        endpointId={endpoint.endpointId}
        webhookUrl={webhookUrl}
        onCreateForwardTarget={endpoint.actions.createForwardTarget}
        onCopyWebhookUrl={copyWebhookUrl}
        onDeleteForwardTarget={endpoint.actions.deleteForwardTarget}
        onLoadEndpointAccountStatus={endpoint.actions.loadEndpointAccountStatus}
        onLoadForwardTargets={endpoint.actions.loadForwardTargets}
        onLoadEndpointStats={endpoint.actions.loadEndpointStats}
        onNewEndpoint={endpoint.actions.startNewEndpoint}
        onRenameEndpoint={endpoint.actions.renameEndpoint}
        onResetResponseOverride={endpoint.actions.clearResponseOverride}
        onSaveEndpointToAccount={endpoint.actions.saveEndpointToAccount}
        onSaveResponseOverride={endpoint.actions.saveResponseOverride}
        onSwitchEndpoint={endpoint.actions.switchEndpoint}
        onUpdateForwardTarget={endpoint.actions.updateForwardTarget}
      />

      {endpoint.errorMessage ? (
        <Alert className="animate-in rounded-md duration-200 ease-out fade-in-0 slide-in-from-top-1 motion-reduce:animate-none">
          <AlertCircleIcon />
          <AlertTitle>REQUEST FAILED</AlertTitle>
          <AlertDescription>{endpoint.errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid flex-1 overflow-hidden rounded-md border bg-card sm:min-h-0 sm:grid-cols-[minmax(17.5rem,20rem)_minmax(0,1fr)] sm:grid-rows-1">
        <EndpointPanel
          canRefresh={endpoint.canRefresh}
          docsUrl={docsUrl}
          hasMoreRequests={endpoint.hasMoreRequests}
          isClearing={endpoint.isClearing}
          isLoading={endpoint.isLoading}
          isLoadingOlderRequests={endpoint.isLoadingOlderRequests}
          requestSearch={endpoint.requestSearch}
          requests={endpoint.requests}
          replayingRequestIds={endpoint.replayingRequestIds}
          selectedId={endpoint.selectedRequest?.id ?? null}
          webhookUrl={webhookUrl}
          onClearEndpoint={endpoint.actions.clearEndpoint}
          onLoadOlderRequests={endpoint.actions.loadOlderRequests}
          onRefreshEndpoint={endpoint.actions.refreshEndpoint}
          onReplayRequest={endpoint.actions.replayRequest}
          onSearchRequests={endpoint.actions.searchRequests}
          onSelectRequest={endpoint.actions.selectRequest}
        />
        <RequestDetail
          isReplaying={endpoint.isReplayingSelectedRequest}
          request={endpoint.selectedRequest}
          onReplayRequest={endpoint.actions.replayRequest}
        />
      </section>
    </main>
  )
}
