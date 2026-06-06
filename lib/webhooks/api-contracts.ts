import type { CapturedRequest } from "@/lib/webhooks/types"
import type {
  EndpointResponseConfig,
  EndpointResponseOverrideInput,
} from "@/lib/webhooks/endpoint-response"

export type CreateEndpointResponse = {
  endpointId: string
}

export type RequestsResponse = {
  endpointId: string
  requests: CapturedRequest[]
}

export type EndpointResponseConfigResponse = {
  endpointId: string
  response: EndpointResponseConfig
}

export type UpdateEndpointResponseOverrideRequest =
  EndpointResponseOverrideInput
