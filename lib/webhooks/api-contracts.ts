import type { CapturedRequest } from "@/lib/webhooks/types"
import type {
  EndpointResponseConfig,
  EndpointResponseOverrideInput,
} from "@/lib/webhooks/endpoint-response"

export type CreateEndpointResponse = {
  endpointId: string
  name: string | null
}

export type EndpointMetadataResponse = {
  endpointId: string
  name: string | null
}

export type EndpointStatsResponse = {
  endpointId: string
  requestCount: number
  bodySizeBytes: number
  createdAt: string
  lastActivityAt: string
}

export type UpdateEndpointMetadataRequest = {
  name: string | null
}

export type RequestsResponse = {
  endpointId: string
  page: {
    hasMore: boolean
    nextCursor: string | null
  }
  requests: CapturedRequest[]
}

export type RequestResponse = {
  endpointId: string
  request: CapturedRequest
}

export type EndpointResponseConfigResponse = {
  endpointId: string
  response: EndpointResponseConfig
}

export type UpdateEndpointResponseOverrideRequest =
  EndpointResponseOverrideInput
