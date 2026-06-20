import type { CapturedRequest } from "./types.js"
import type {
  EndpointResponseConfig,
  EndpointResponseOverrideInput,
} from "./endpoint-response.js"
import type { EndpointForwardTarget } from "./endpoint-forwarding.js"

export type CreateEndpointResponse = {
  endpointId: string
  name: string | null
}

export type EndpointMetadataResponse = {
  endpointId: string
  name: string | null
}

export type EndpointsResponse = {
  endpoints: EndpointMetadataResponse[]
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

export type ReplayRequestResponse = {
  endpointId: string
  originalRequestId: string
  request: CapturedRequest
}

export type EndpointResponseConfigResponse = {
  endpointId: string
  response: EndpointResponseConfig
}

export type UpdateEndpointResponseOverrideRequest =
  EndpointResponseOverrideInput

export type EndpointForwardTargetsResponse = {
  endpointId: string
  targets: EndpointForwardTarget[]
}

export type EndpointForwardTargetResponse = {
  endpointId: string
  target: EndpointForwardTarget
}

export type CreateEndpointForwardTargetRequest = {
  url: string
  pathMode?: string
}

export type UpdateEndpointForwardTargetRequest = {
  url?: string
  pathMode?: string
  enabled?: boolean
}
