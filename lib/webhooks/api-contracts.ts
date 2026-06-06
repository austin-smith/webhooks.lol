import type { CapturedRequest } from "@/lib/webhooks/types"
import type {
  InboxResponseConfig,
  InboxResponseOverrideInput,
} from "@/lib/webhooks/inbox-response"

export type CreateInboxResponse = {
  token: string
}

export type RequestsResponse = {
  token: string
  requests: CapturedRequest[]
}

export type InboxResponseConfigResponse = {
  token: string
  response: InboxResponseConfig
}

export type UpdateInboxResponseOverrideRequest = InboxResponseOverrideInput
