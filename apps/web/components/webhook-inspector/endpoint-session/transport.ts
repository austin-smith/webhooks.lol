import type { CapturedRequest } from "@webhooks-lol/webhooks-core/types"
import type {
  CreateEndpointForwardTargetRequest,
  CreateEndpointResponse,
  EndpointAccountResponse,
  EndpointForwardTargetResponse,
  EndpointForwardTargetsResponse,
  EndpointMetadataResponse,
  EndpointResponseConfigResponse,
  EndpointStatsResponse,
  EndpointsResponse,
  ReplayRequestResponse,
  RequestsResponse,
  UpdateEndpointForwardTargetRequest,
  UpdateEndpointMetadataRequest,
  UpdateEndpointResponseOverrideRequest,
} from "@webhooks-lol/webhooks-core/api-contracts"
import type { EndpointResponseConfig } from "@webhooks-lol/webhooks-core/endpoint-response"
import { encodeEndpointId } from "@webhooks-lol/webhooks-core/endpoint-id"
import {
  requestSearchIsActive,
  serializeRequestSearchCriteria,
  type RequestSearchCriteria,
} from "@webhooks-lol/webhooks-core/request-search"

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
  createForwardTarget: (
    endpointId: string,
    target: CreateEndpointForwardTargetRequest
  ) => Promise<EndpointForwardTarget>
  createEndpoint: () => Promise<EndpointMetadata>
  deleteEndpoint: (endpointId: string) => Promise<void>
  deleteForwardTarget: (endpointId: string, targetId: string) => Promise<void>
  listForwardTargets: (endpointId: string) => Promise<EndpointForwardTarget[]>
  listOwnedEndpoints: () => Promise<EndpointMetadata[]>
  loadEndpointAccountStatus: (
    endpointId: string
  ) => Promise<EndpointAccountStatus>
  loadEndpoint: (endpointId: string) => Promise<EndpointMetadata>
  loadEndpointStats: (endpointId: string) => Promise<EndpointStats>
  loadEndpointResponseConfig: (
    endpointId: string
  ) => Promise<EndpointResponseConfig>
  loadRequests: (
    endpointId: string,
    options?: {
      cursor?: string | null
      search?: RequestSearchCriteria
    }
  ) => Promise<CapturedRequestPage>
  saveEndpointResponseOverride: (
    endpointId: string,
    override: UpdateEndpointResponseOverrideRequest
  ) => Promise<EndpointResponseConfig>
  replayRequest: (
    endpointId: string,
    requestId: string
  ) => Promise<CapturedRequest>
  saveEndpointToAccount: (endpointId: string) => Promise<EndpointAccountStatus>
  updateEndpointMetadata: (
    endpointId: string,
    metadata: UpdateEndpointMetadataRequest
  ) => Promise<EndpointMetadata>
  updateForwardTarget: (
    endpointId: string,
    targetId: string,
    target: UpdateEndpointForwardTargetRequest
  ) => Promise<EndpointForwardTarget>
}

export type EndpointMetadata = {
  endpointId: string
  name: string | null
}

export type EndpointAccountStatus = EndpointAccountResponse
export type EndpointStats = EndpointStatsResponse
export type EndpointForwardTarget =
  EndpointForwardTargetsResponse["targets"][number]

export class EndpointTransportError extends Error {
  readonly status: number
  readonly statusText: string

  constructor({
    message,
    status,
    statusText,
  }: {
    message: string
    status: number
    statusText: string
  }) {
    super(message)
    this.name = "EndpointTransportError"
    this.status = status
    this.statusText = statusText
  }
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
      const encodedEndpointId = encodeEndpointId(endpointId)
      const response = await fetcher(
        `/api/endpoints/${encodedEndpointId}/response`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) {
        throw await createEndpointTransportError(
          response,
          "Could not reset response override."
        )
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
        throw await createEndpointTransportError(
          response,
          "Could not clear endpoint."
        )
      }
    },
    async createForwardTarget(endpointId, target) {
      const encodedEndpointId = encodeEndpointId(endpointId)
      const response = await fetcher(
        `/api/endpoints/${encodedEndpointId}/forward-targets`,
        {
          body: JSON.stringify(target),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        }
      )

      if (!response.ok) {
        throw await createEndpointTransportError(
          response,
          "Could not create forward target."
        )
      }

      const data = (await response.json()) as EndpointForwardTargetResponse

      return data.target
    },
    async createEndpoint() {
      const response = await fetcher("/api/endpoints", {
        method: "POST",
      })

      if (!response.ok) {
        throw await createEndpointTransportError(
          response,
          "Could not create endpoint."
        )
      }

      const data = (await response.json()) as CreateEndpointResponse

      return mapEndpointMetadata(data)
    },
    async deleteEndpoint(endpointId) {
      const encodedEndpointId = encodeEndpointId(endpointId)
      const response = await fetcher(`/api/endpoints/${encodedEndpointId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw await createEndpointTransportError(
          response,
          "Could not delete endpoint."
        )
      }
    },
    async deleteForwardTarget(endpointId, targetId) {
      const encodedEndpointId = encodeEndpointId(endpointId)
      const response = await fetcher(
        `/api/endpoints/${encodedEndpointId}/forward-targets/${targetId}`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) {
        throw await createEndpointTransportError(
          response,
          "Could not delete forward target."
        )
      }
    },
    async listOwnedEndpoints() {
      const response = await fetcher("/api/endpoints", {
        cache: "no-store",
      })

      if (!response.ok) {
        throw await createEndpointTransportError(
          response,
          "Could not load endpoints."
        )
      }

      const data = (await response.json()) as EndpointsResponse

      return data.endpoints.map(mapEndpointMetadata)
    },
    async listForwardTargets(endpointId) {
      const encodedEndpointId = encodeEndpointId(endpointId)
      const response = await fetcher(
        `/api/endpoints/${encodedEndpointId}/forward-targets`,
        {
          cache: "no-store",
        }
      )

      if (!response.ok) {
        throw await createEndpointTransportError(
          response,
          "Could not load forward targets."
        )
      }

      const data = (await response.json()) as EndpointForwardTargetsResponse

      return data.targets
    },
    async loadEndpointAccountStatus(endpointId) {
      const encodedEndpointId = encodeEndpointId(endpointId)
      const response = await fetcher(
        `/api/endpoints/${encodedEndpointId}/account`,
        {
          cache: "no-store",
        }
      )

      if (!response.ok) {
        throw await createEndpointTransportError(
          response,
          "Could not load endpoint account status."
        )
      }

      return (await response.json()) as EndpointAccountStatus
    },
    async loadEndpoint(endpointId) {
      const encodedEndpointId = encodeEndpointId(endpointId)
      const response = await fetcher(`/api/endpoints/${encodedEndpointId}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw await createEndpointTransportError(
          response,
          "Could not load endpoint."
        )
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
        throw await createEndpointTransportError(
          response,
          "Could not load endpoint details."
        )
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
        throw await createEndpointTransportError(
          response,
          "Could not load response override."
        )
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

      if (options.search && requestSearchIsActive(options.search)) {
        for (const [key, value] of serializeRequestSearchCriteria(
          options.search
        )) {
          searchParams.append(key, value)
        }
      }

      const query = searchParams.toString()
      const response = await fetcher(
        `/api/endpoints/${encodedEndpointId}/requests${query ? `?${query}` : ""}`,
        {
          cache: "no-store",
        }
      )

      if (!response.ok) {
        throw await createEndpointTransportError(
          response,
          "Could not load requests."
        )
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
        throw await createEndpointTransportError(
          response,
          "Could not save response override."
        )
      }

      const data = (await response.json()) as EndpointResponseConfigResponse

      return data.response
    },
    async replayRequest(endpointId, requestId) {
      const encodedEndpointId = encodeEndpointId(endpointId)
      const response = await fetcher(
        `/api/endpoints/${encodedEndpointId}/requests/${requestId}/replay`,
        {
          method: "POST",
        }
      )

      if (!response.ok) {
        throw await createEndpointTransportError(
          response,
          "Could not replay request."
        )
      }

      const data = (await response.json()) as ReplayRequestResponse

      return data.request
    },
    async saveEndpointToAccount(endpointId) {
      const encodedEndpointId = encodeEndpointId(endpointId)
      const response = await fetcher(
        `/api/endpoints/${encodedEndpointId}/account`,
        {
          method: "POST",
        }
      )

      if (!response.ok) {
        throw await createEndpointTransportError(
          response,
          "Could not save endpoint."
        )
      }

      return (await response.json()) as EndpointAccountStatus
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
        throw await createEndpointTransportError(
          response,
          "Could not save endpoint."
        )
      }

      const data = (await response.json()) as EndpointMetadataResponse

      return mapEndpointMetadata(data)
    },
    async updateForwardTarget(endpointId, targetId, target) {
      const encodedEndpointId = encodeEndpointId(endpointId)
      const response = await fetcher(
        `/api/endpoints/${encodedEndpointId}/forward-targets/${targetId}`,
        {
          body: JSON.stringify(target),
          headers: {
            "content-type": "application/json",
          },
          method: "PATCH",
        }
      )

      if (!response.ok) {
        throw await createEndpointTransportError(
          response,
          "Could not save forward target."
        )
      }

      const data = (await response.json()) as EndpointForwardTargetResponse

      return data.target
    },
  }
}

async function createEndpointTransportError(
  response: Response,
  fallback: string
) {
  return new EndpointTransportError({
    message: await readResponseError(response, fallback),
    status: response.status,
    statusText: response.statusText,
  })
}

async function readResponseError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: unknown }

    if (typeof data.error === "string" && data.error.trim()) {
      return data.error
    }
  } catch {
    // Use the local fallback when the response is not JSON.
  }

  return fallback
}

function mapEndpointMetadata(
  data: CreateEndpointResponse | EndpointMetadataResponse
): EndpointMetadata {
  return {
    endpointId: data.endpointId,
    name: data.name,
  }
}
