import type { CapturedRequest } from "@webhooks-lol/webhooks-core/types"

export type ReplayRequestResult = {
  endpointId: string
  originalRequestId: string
  request: CapturedRequest
}
