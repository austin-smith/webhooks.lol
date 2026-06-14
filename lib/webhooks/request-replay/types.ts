import type { CapturedRequest } from "@/lib/webhooks/types"

export type ReplayRequestResult = {
  endpointId: string
  originalRequestId: string
  request: CapturedRequest
}
