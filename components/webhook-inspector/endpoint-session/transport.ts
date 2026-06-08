import type { CapturedRequest } from "@/lib/webhooks/types"
import type {
  CreateEndpointResponse,
  EndpointMetadataResponse,
  EndpointResponseConfigResponse,
  EndpointStatsResponse,
  RequestsResponse,
  UpdateEndpointMetadataRequest,
  UpdateEndpointResponseOverrideRequest,
} from "@/lib/webhooks/api-contracts"
import type { EndpointResponseConfig } from "@/lib/webhooks/endpoint-response"
import { encodeEndpointId } from "@/lib/webhooks/endpoint-id"

export type CapturedRequestPage = {
  hasMore: boolean
  nextCursor: string | null
  requests: CapturedRequest[]
}

export type EndpointTransport = {
  clearEndpointResponseOverride: (
    endpointId: string
  ) => Promise<EndpointResponseConfig>
  clearEndpoint: (endpointId: string) => Promise<void>
  createEndpoint: () => Promise<EndpointMetadata>
  loadEndpoint: (endpointId: string) => Promise<EndpointMetadata>
  loadEndpointStats: (endpointId: string) => Promise<EndpointStats>
  loadEndpointResponseConfig: (
    endpointId: string
  ) => Promise<EndpointResponseConfig>
  loadRequests: (
    endpointId: string,
    options?: {
      cursor?: string | null
    }
  ) => Promise<CapturedRequestPage>
  saveEndpointResponseOverride: (
    endpointId: string,
    override: UpdateEndpointResponseOverrideRequest
  ) => Promise<EndpointResponseConfig>
  updateEndpointMetadata: (
    endpointId: string,
    metadata: UpdateEndpointMetadataRequest
  ) => Promise<EndpointMetadata>
}

export type EndpointMetadata = {
  endpointId: string
  name: string | null
}

export type EndpointStats = EndpointStatsResponse

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

export function createFetchEndpointTransport(
  fetcher: Fetcher = (...args) => fetch(...args)
): EndpointTransport {
  return {
    async clearEndpointResponseOverride(endpointId) {
      const encodedEndpointId = encodeEndpointId(endpointId)
      const response = await fetcher(
        `/api/endpoints/${encodedEndpointId}/response`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) {
        throw new Error("Could not reset response override.")
      }

      const data = (await response.json()) as EndpointResponseConfigResponse

      return data.response
    },
    async clearEndpoint(endpointId) {
      const encodedEndpointId = encodeEndpointId(endpointId)
      const response = await fetcher(
        `/api/endpoints/${encodedEndpointId}/requests`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) {
        throw new Error("Could not clear endpoint.")
      }
    },
    async createEndpoint() {
      const response = await fetcher("/api/endpoints", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Could not create endpoint.")
      }

      const data = (await response.json()) as CreateEndpointResponse

      return mapEndpointMetadata(data)
    },
    async loadEndpoint(endpointId) {
      const encodedEndpointId = encodeEndpointId(endpointId)
      const response = await fetcher(`/api/endpoints/${encodedEndpointId}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("Could not load endpoint.")
      }

      const data = (await response.json()) as EndpointMetadataResponse

      return mapEndpointMetadata(data)
    },
    async loadEndpointStats(endpointId) {
      const encodedEndpointId = encodeEndpointId(endpointId)
      const response = await fetcher(
        `/api/endpoints/${encodedEndpointId}/stats`,
        {
          cache: "no-store",
        }
      )

      if (!response.ok) {
        throw new Error("Could not load endpoint details.")
      }

      return (await response.json()) as EndpointStatsResponse
    },
    async loadEndpointResponseConfig(endpointId) {
      const encodedEndpointId = encodeEndpointId(endpointId)
      const response = await fetcher(
        `/api/endpoints/${encodedEndpointId}/response`,
        {
          cache: "no-store",
        }
      )

      if (!response.ok) {
        throw new Error("Could not load response override.")
      }

      const data = (await response.json()) as EndpointResponseConfigResponse

      return data.response
    },
    async loadRequests(endpointId, options = {}) {
      const encodedEndpointId = encodeEndpointId(endpointId)
      const searchParams = new URLSearchParams()

      if (options.cursor) {
        searchParams.set("cursor", options.cursor)
      }

      const query = searchParams.toString()
      const response = await fetcher(
        `/api/endpoints/${encodedEndpointId}/requests${query ? `?${query}` : ""}`,
        {
          cache: "no-store",
        }
      )

      if (!response.ok) {
        throw new Error("Could not load requests.")
      }

      const data = (await response.json()) as RequestsResponse

      return {
        hasMore: data.page.hasMore,
        nextCursor: data.page.nextCursor,
        requests: data.requests,
      }
    },
    async saveEndpointResponseOverride(endpointId, override) {
      const encodedEndpointId = encodeEndpointId(endpointId)
      const response = await fetcher(
        `/api/endpoints/${encodedEndpointId}/response`,
        {
          body: JSON.stringify(override),
          headers: {
            "content-type": "application/json",
          },
          method: "PUT",
        }
      )

      if (!response.ok) {
        throw new Error("Could not save response override.")
      }

      const data = (await response.json()) as EndpointResponseConfigResponse

      return data.response
    },
    async updateEndpointMetadata(endpointId, metadata) {
      const encodedEndpointId = encodeEndpointId(endpointId)
      const response = await fetcher(`/api/endpoints/${encodedEndpointId}`, {
        body: JSON.stringify(metadata),
        headers: {
          "content-type": "application/json",
        },
        method: "PATCH",
      })

      if (!response.ok) {
        throw new Error("Could not save endpoint.")
      }

      const data = (await response.json()) as EndpointMetadataResponse

      return mapEndpointMetadata(data)
    },
  }
}

function mapEndpointMetadata(
  data: CreateEndpointResponse | EndpointMetadataResponse
): EndpointMetadata {
  return {
    endpointId: data.endpointId,
    name: data.name,
  }
}
