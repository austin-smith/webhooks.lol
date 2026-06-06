"use client"

import * as React from "react"
import { AlertCircleIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { InboxPanel } from "./inbox-panel"
import { useBrowserInboxSession } from "./inbox-session/use-browser-inbox-session"
import { InspectorHeader } from "./inspector-header"
import { RequestDetail } from "./request-detail"
import { useBrowserOrigin } from "./use-browser-origin"

export function WebhookInspector() {
  const origin = useBrowserOrigin()
  const inbox = useBrowserInboxSession()
  const webhookUrl =
    inbox.token && origin ? `${origin}/api/hook/${inbox.token}` : ""
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
      <div className="flex min-h-[calc(100svh-2rem)] w-full flex-1 flex-col gap-4 duration-300 ease-out animate-in fade-in-0 lg:min-h-[calc(100svh-2.5rem)] motion-reduce:animate-none">
        <InspectorHeader
          connectionState={inbox.connectionState}
          copied={copied}
          copyMessage={copyMessage}
          inboxNames={inbox.inboxNames}
          isLoading={inbox.isLoading}
          recentTokens={inbox.recentTokens}
          token={inbox.token}
          webhookUrl={webhookUrl}
          onCopyWebhookUrl={copyWebhookUrl}
          onNewInbox={inbox.actions.startNewInbox}
          onRenameInbox={inbox.actions.renameInbox}
          onSwitchInbox={inbox.actions.switchInbox}
        />

        {inbox.errorMessage ? (
          <Alert className="rounded-md duration-200 ease-out animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none">
            <AlertCircleIcon />
            <AlertTitle>REQUEST FAILED</AlertTitle>
            <AlertDescription>{inbox.errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid flex-1 overflow-hidden rounded-md border bg-card sm:min-h-0 sm:grid-cols-[minmax(17.5rem,20rem)_minmax(0,1fr)]">
          <InboxPanel
            canRefresh={inbox.canRefresh}
            isClearing={inbox.isClearing}
            isLoading={inbox.isLoading}
            requests={inbox.requests}
            selectedId={inbox.selectedRequest?.id ?? null}
            onClearInbox={inbox.actions.clearInbox}
            onRefreshInbox={inbox.actions.refreshInbox}
            onSelectRequest={inbox.actions.selectRequest}
          />
          <RequestDetail request={inbox.selectedRequest} />
        </section>
      </div>
    </main>
  )
}
