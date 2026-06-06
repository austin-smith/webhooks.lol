"use client"

import * as React from "react"
import { AlertCircleIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { EndpointPanel } from "./endpoint-panel"
import { useBrowserEndpointSession } from "./endpoint-session/use-browser-endpoint-session"
import { InspectorHeader } from "./inspector-header"
import { RequestDetail } from "./request-detail"
import { useBrowserOrigin } from "./use-browser-origin"

export function WebhookInspector() {
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
    <main className="flex min-h-svh bg-background p-4 font-mono text-xs text-foreground lg:p-5">
      <div className="flex min-h-[calc(100svh-2rem)] w-full flex-1 animate-in flex-col gap-4 duration-300 ease-out fade-in-0 motion-reduce:animate-none lg:min-h-[calc(100svh-2.5rem)]">
        <InspectorHeader
          connectionState={endpoint.connectionState}
          copied={copied}
          copyMessage={copyMessage}
          endpointNames={endpoint.endpointNames}
          isLoading={endpoint.isLoading}
          isSavingResponse={endpoint.isSavingResponse}
          recentEndpointIds={endpoint.recentEndpointIds}
          responseConfig={endpoint.responseConfig}
          endpointId={endpoint.endpointId}
          webhookUrl={webhookUrl}
          onCopyWebhookUrl={copyWebhookUrl}
          onNewEndpoint={endpoint.actions.startNewEndpoint}
          onRenameEndpoint={endpoint.actions.renameEndpoint}
          onResetResponseOverride={endpoint.actions.clearResponseOverride}
          onSaveResponseOverride={endpoint.actions.saveResponseOverride}
          onSwitchEndpoint={endpoint.actions.switchEndpoint}
        />

        {endpoint.errorMessage ? (
          <Alert className="animate-in rounded-md duration-200 ease-out fade-in-0 slide-in-from-top-1 motion-reduce:animate-none">
            <AlertCircleIcon />
            <AlertTitle>REQUEST FAILED</AlertTitle>
            <AlertDescription>{endpoint.errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid flex-1 overflow-hidden rounded-md border bg-card sm:min-h-0 sm:grid-cols-[minmax(17.5rem,20rem)_minmax(0,1fr)]">
          <EndpointPanel
            canRefresh={endpoint.canRefresh}
            isClearing={endpoint.isClearing}
            isLoading={endpoint.isLoading}
            requests={endpoint.requests}
            selectedId={endpoint.selectedRequest?.id ?? null}
            onClearEndpoint={endpoint.actions.clearEndpoint}
            onRefreshEndpoint={endpoint.actions.refreshEndpoint}
            onSelectRequest={endpoint.actions.selectRequest}
          />
          <RequestDetail request={endpoint.selectedRequest} />
        </section>
      </div>
    </main>
  )
}
