import type { CapturedRequest } from "@/lib/webhooks/types"
import type {
  InboxResponseConfig,
  InboxResponseOverrideInput,
} from "@/lib/webhooks/inbox-response"

export type ConnectionState = "live" | "connecting" | "offline"

export type InboxActions = {
  clearInbox: () => void
  clearResponseOverride: () => Promise<void>
  renameInbox: (name: string) => void
  refreshInbox: () => void
  saveResponseOverride: (override: InboxResponseOverrideInput) => Promise<void>
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
  isSavingResponse: boolean
  recentTokens: string[]
  responseConfig: InboxResponseConfig
  requests: CapturedRequest[]
  selectedRequest: CapturedRequest | null
  token: string | null
}

export type WebhookInbox = WebhookInboxState & {
  actions: InboxActions
}
