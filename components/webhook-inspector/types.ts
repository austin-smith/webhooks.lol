import type { CapturedRequest } from "@/lib/webhook-types"

export type ConnectionState = "live" | "connecting" | "offline"

export type InboxActions = {
  clearInbox: () => void
  renameInbox: (name: string) => void
  refreshInbox: () => void
  selectRequest: (id: string) => void
  startNewInbox: () => void
  switchInbox: (token: string) => void
}

export type InboxNames = Record<string, string>

export type WebhookInboxState = {
  canRefresh: boolean
  connectionState: ConnectionState
  errorMessage: string | null
  inboxNames: InboxNames
  isClearing: boolean
  isLoading: boolean
  recentTokens: string[]
  requests: CapturedRequest[]
  selectedRequest: CapturedRequest | null
  token: string | null
}

export type WebhookInbox = WebhookInboxState & {
  actions: InboxActions
}
