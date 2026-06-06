import type { CapturedRequest } from "@/lib/webhooks/types"

export type CreateInboxResponse = {
  token: string
}

export type RequestsResponse = {
  token: string
  requests: CapturedRequest[]
}
