import { describe, expect, it, vi } from "vitest"

import { createFetchEndpointTransport } from "@/components/webhook-inspector/endpoint-session/transport"
import { DEFAULT_ENDPOINT_RESPONSE_CONFIG } from "@/lib/webhooks/endpoint-response"
import type { CapturedRequest } from "@/lib/webhooks/types"

function createResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  })
}

function createRequest(): CapturedRequest {
  return {
    id: "captured-1",
    endpointId: "endpoint",
    method: "POST",
    url: "/orders",
    path: "/orders",
    query: {},
    headers: {},
    bodyText: "",
    bodyBase64: "",
    bodySize: 0,
    contentType: null,
    receivedAt: "2026-06-05T00:00:00.000Z",
    ip: null,
  }
}

function createRequestsResponse(
  requests: CapturedRequest[],
  page: {
    hasMore: boolean
    nextCursor: string | null
  } = {
    hasMore: false,
    nextCursor: null,
  }
) {
  return {
    page,
    requests,
  }
}

describe("endpoint transport", () => {
  it("creates, loads, and clears through the fetch adapter", async () => {
    const customResponse = {
      mode: "custom" as const,
      status: 201,
      contentType: "application/json",
      body: '{"ok":true}',
    }
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({ endpointId: "new-endpoint", name: null })
      )
      .mockResolvedValueOnce(
        createResponse({ endpointId: "endpoint", name: "Stripe" })
      )
      .mockResolvedValueOnce(
        createResponse(
          createRequestsResponse([createRequest()], {
            hasMore: true,
            nextCursor: "cursor-1",
          })
        )
      )
      .mockResolvedValueOnce(createResponse(createRequestsResponse([])))
      .mockResolvedValueOnce(
        createResponse({
          endpointId: "endpoint",
          response: DEFAULT_ENDPOINT_RESPONSE_CONFIG,
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          endpointId: "endpoint",
          response: customResponse,
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          endpointId: "endpoint",
          response: DEFAULT_ENDPOINT_RESPONSE_CONFIG,
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          endpointId: "endpoint",
          name: "Payments",
        })
      )
    const transport = createFetchEndpointTransport(fetcher)
    const override = {
      status: 201,
      contentType: "application/json",
      body: '{"ok":true}',
    }

    await expect(transport.createEndpoint()).resolves.toEqual({
      endpointId: "new-endpoint",
      name: null,
    })
    await expect(transport.loadEndpoint("endpoint")).resolves.toEqual({
      endpointId: "endpoint",
      name: "Stripe",
    })
    await expect(transport.loadRequests("endpoint")).resolves.toEqual({
      hasMore: true,
      nextCursor: "cursor-1",
      requests: [createRequest()],
    })
    await expect(transport.clearEndpoint("endpoint")).resolves.toBeUndefined()
    await expect(
      transport.loadEndpointResponseConfig("endpoint")
    ).resolves.toEqual(DEFAULT_ENDPOINT_RESPONSE_CONFIG)
    await expect(
      transport.saveEndpointResponseOverride("endpoint", override)
    ).resolves.toEqual(customResponse)
    await expect(
      transport.clearEndpointResponseOverride("endpoint")
    ).resolves.toEqual(DEFAULT_ENDPOINT_RESPONSE_CONFIG)
    await expect(
      transport.updateEndpointMetadata("endpoint", { name: "Payments" })
    ).resolves.toEqual({
      endpointId: "endpoint",
      name: "Payments",
    })

    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/endpoints", {
      method: "POST",
    })
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/endpoints/endpoint", {
      cache: "no-store",
    })
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "/api/endpoints/endpoint/requests",
      {
        cache: "no-store",
      }
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      "/api/endpoints/endpoint/requests",
      {
        method: "DELETE",
      }
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      5,
      "/api/endpoints/endpoint/response",
      {
        cache: "no-store",
      }
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      6,
      "/api/endpoints/endpoint/response",
      {
        body: JSON.stringify(override),
        headers: {
          "content-type": "application/json",
        },
        method: "PUT",
      }
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      7,
      "/api/endpoints/endpoint/response",
      {
        method: "DELETE",
      }
    )
    expect(fetcher).toHaveBeenNthCalledWith(8, "/api/endpoints/endpoint", {
      body: JSON.stringify({ name: "Payments" }),
      headers: {
        "content-type": "application/json",
      },
      method: "PATCH",
    })
  })

  it("loads older request pages with an encoded cursor", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(createResponse(createRequestsResponse([])))
    const transport = createFetchEndpointTransport(fetcher)

    await transport.loadRequests("endpoint", {
      cursor: "2026-06-05T00:00:00.000Z|captured-1",
    })

    expect(fetcher).toHaveBeenCalledWith(
      "/api/endpoints/endpoint/requests?cursor=2026-06-05T00%3A00%3A00.000Z%7Ccaptured-1",
      {
        cache: "no-store",
      }
    )
  })

  it("maps failed responses to stable errors", async () => {
    const transport = createFetchEndpointTransport(
      vi.fn().mockResolvedValue(createResponse({}, { status: 500 }))
    )

    await expect(transport.createEndpoint()).rejects.toThrow(
      "Could not create endpoint."
    )
    await expect(transport.loadEndpoint("endpoint")).rejects.toThrow(
      "Could not load endpoint."
    )
    await expect(transport.loadRequests("endpoint")).rejects.toThrow(
      "Could not load requests."
    )
    await expect(transport.clearEndpoint("endpoint")).rejects.toThrow(
      "Could not clear endpoint."
    )
    await expect(
      transport.loadEndpointResponseConfig("endpoint")
    ).rejects.toThrow("Could not load response override.")
    await expect(
      transport.saveEndpointResponseOverride("endpoint", {
        status: 200,
        contentType: "text/plain",
        body: "",
      })
    ).rejects.toThrow("Could not save response override.")
    await expect(
      transport.clearEndpointResponseOverride("endpoint")
    ).rejects.toThrow("Could not reset response override.")
    await expect(
      transport.updateEndpointMetadata("endpoint", { name: null })
    ).rejects.toThrow("Could not save endpoint.")
  })
})
