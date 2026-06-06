import type { CapturedRequest } from "@/lib/webhooks/types"
import type {
  CreateEndpointResponse,
  EndpointResponseConfigResponse,
  RequestsResponse,
  UpdateEndpointResponseOverrideRequest,
} from "@/lib/webhooks/api-contracts"
import type { EndpointResponseConfig } from "@/lib/webhooks/endpoint-response"

export type EndpointTransport = {
  clearEndpointResponseOverride: (
    endpointId: string
  ) => Promise<EndpointResponseConfig>
  clearEndpoint: (endpointId: string) => Promise<void>
  createEndpoint: () => Promise<string>
  loadEndpointResponseConfig: (
    endpointId: string
  ) => Promise<EndpointResponseConfig>
  loadRequests: (endpointId: string) => Promise<CapturedRequest[]>
  saveEndpointResponseOverride: (
    endpointId: string,
    override: UpdateEndpointResponseOverrideRequest
  ) => Promise<EndpointResponseConfig>
}

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

export function createFetchEndpointTransport(
  fetcher: Fetcher = (...args) => fetch(...args)
): EndpointTransport {
  return {
    async clearEndpointResponseOverride(endpointId) {
      const response = await fetcher(
        `/api/endpoints/${endpointId}/response`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) {
        throw new Error("Could not reset response override.")
      }

      const data =
        (await response.json()) as EndpointResponseConfigResponse

      return data.response
    },
    async clearEndpoint(endpointId) {
      const response = await fetcher(
        `/api/endpoints/${endpointId}/requests`,
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

      return data.endpointId
    },
    async loadEndpointResponseConfig(endpointId) {
      const response = await fetcher(
        `/api/endpoints/${endpointId}/response`,
        {
          cache: "no-store",
        }
      )

      if (!response.ok) {
        throw new Error("Could not load response override.")
      }

      const data =
        (await response.json()) as EndpointResponseConfigResponse

      return data.response
    },
    async loadRequests(endpointId) {
      const response = await fetcher(
        `/api/endpoints/${endpointId}/requests`,
        {
          cache: "no-store",
        }
      )

      if (!response.ok) {
        throw new Error("Could not load requests.")
      }

      const data = (await response.json()) as RequestsResponse

      return data.requests
    },
    async saveEndpointResponseOverride(endpointId, override) {
      const response = await fetcher(
        `/api/endpoints/${endpointId}/response`,
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

      const data =
        (await response.json()) as EndpointResponseConfigResponse

      return data.response
    },
  }
}
