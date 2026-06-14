import { describe, expect, it, vi } from "vitest"

import {
  createFetchEndpointTransport,
  type EndpointForwardTarget,
} from "@/components/webhook-inspector/endpoint-session/transport"
import { DEFAULT_ENDPOINT_RESPONSE_CONFIG } from "@/lib/webhooks/endpoint-response"
import {
  parseAdvancedRequestSearchQuery,
  parseRequestSearchCriteria,
} from "@/lib/webhooks/request-search"
import type { CapturedRequest } from "@/lib/webhooks/types"

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"
const NEW_ENDPOINT_ID = "22222222-2222-4222-8222-222222222222"

function createResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  })
}

function createRequest(): CapturedRequest {
  return {
    id: "captured-1",
    endpointId: ENDPOINT_ID,
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

function createForwardTarget(
  overrides: Partial<EndpointForwardTarget> = {}
): EndpointForwardTarget {
  return {
    id: "forward-target-1",
    endpointId: ENDPOINT_ID,
    url: "https://example.com/webhook",
    pathMode: "preserve",
    enabled: true,
    deleted: false,
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:00.000Z",
    ...overrides,
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
        createResponse({ endpointId: NEW_ENDPOINT_ID, name: null })
      )
      .mockResolvedValueOnce(
        createResponse({ endpointId: ENDPOINT_ID, name: "Stripe" })
      )
      .mockResolvedValueOnce(
        createResponse({
          endpointId: ENDPOINT_ID,
          requestCount: 12,
          bodySizeBytes: 86220,
          createdAt: "2026-06-05T00:00:00.000Z",
          lastActivityAt: "2026-06-05T00:10:00.000Z",
        })
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
          endpointId: ENDPOINT_ID,
          response: DEFAULT_ENDPOINT_RESPONSE_CONFIG,
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          endpointId: ENDPOINT_ID,
          response: customResponse,
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          endpointId: ENDPOINT_ID,
          response: DEFAULT_ENDPOINT_RESPONSE_CONFIG,
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          endpointId: ENDPOINT_ID,
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
      endpointId: NEW_ENDPOINT_ID,
      name: null,
    })
    await expect(transport.loadEndpoint(ENDPOINT_ID)).resolves.toEqual({
      endpointId: ENDPOINT_ID,
      name: "Stripe",
    })
    await expect(transport.loadEndpointStats(ENDPOINT_ID)).resolves.toEqual({
      endpointId: ENDPOINT_ID,
      requestCount: 12,
      bodySizeBytes: 86220,
      createdAt: "2026-06-05T00:00:00.000Z",
      lastActivityAt: "2026-06-05T00:10:00.000Z",
    })
    await expect(transport.loadRequests(ENDPOINT_ID)).resolves.toEqual({
      hasMore: true,
      nextCursor: "cursor-1",
      requests: [createRequest()],
    })
    await expect(transport.clearEndpoint(ENDPOINT_ID)).resolves.toBeUndefined()
    await expect(
      transport.loadEndpointResponseConfig(ENDPOINT_ID)
    ).resolves.toEqual(DEFAULT_ENDPOINT_RESPONSE_CONFIG)
    await expect(
      transport.saveEndpointResponseOverride(ENDPOINT_ID, override)
    ).resolves.toEqual(customResponse)
    await expect(
      transport.clearEndpointResponseOverride(ENDPOINT_ID)
    ).resolves.toEqual(DEFAULT_ENDPOINT_RESPONSE_CONFIG)
    await expect(
      transport.updateEndpointMetadata(ENDPOINT_ID, { name: "Payments" })
    ).resolves.toEqual({
      endpointId: ENDPOINT_ID,
      name: "Payments",
    })

    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/endpoints", {
      method: "POST",
    })
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      `/api/endpoints/${ENDPOINT_ID}`,
      {
        cache: "no-store",
      }
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      `/api/endpoints/${ENDPOINT_ID}/stats`,
      {
        cache: "no-store",
      }
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      `/api/endpoints/${ENDPOINT_ID}/requests`,
      {
        cache: "no-store",
      }
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      5,
      `/api/endpoints/${ENDPOINT_ID}/requests`,
      {
        method: "DELETE",
      }
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      6,
      `/api/endpoints/${ENDPOINT_ID}/response`,
      {
        cache: "no-store",
      }
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      7,
      `/api/endpoints/${ENDPOINT_ID}/response`,
      {
        body: JSON.stringify(override),
        headers: {
          "content-type": "application/json",
        },
        method: "PUT",
      }
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      8,
      `/api/endpoints/${ENDPOINT_ID}/response`,
      {
        method: "DELETE",
      }
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      9,
      `/api/endpoints/${ENDPOINT_ID}`,
      {
        body: JSON.stringify({ name: "Payments" }),
        headers: {
          "content-type": "application/json",
        },
        method: "PATCH",
      }
    )
  })

  it("loads older request pages with an encoded cursor", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(createResponse(createRequestsResponse([])))
    const transport = createFetchEndpointTransport(fetcher)

    await transport.loadRequests(ENDPOINT_ID, {
      cursor: "2026-06-05T00:00:00.000Z|captured-1",
    })

    expect(fetcher).toHaveBeenCalledWith(
      `/api/endpoints/${ENDPOINT_ID}/requests?cursor=2026-06-05T00%3A00%3A00.000Z%7Ccaptured-1`,
      {
        cache: "no-store",
      }
    )
  })

  it("loads filtered request pages with explicit search parameters", async () => {
    const parsedSearch = parseRequestSearchCriteria({
      methods: ["POST", "GET"],
      conditions: [
        { field: "path", value: "/payments" },
        { field: "contentType", value: "json" },
      ],
    })

    expect(parsedSearch.kind).toBe("valid")

    if (parsedSearch.kind !== "valid") {
      return
    }

    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(createResponse(createRequestsResponse([])))
    const transport = createFetchEndpointTransport(fetcher)

    await transport.loadRequests(ENDPOINT_ID, {
      cursor: "2026-06-05T00:00:00.000Z|captured-1",
      search: parsedSearch.value,
    })

    expect(fetcher).toHaveBeenCalledWith(
      `/api/endpoints/${ENDPOINT_ID}/requests?cursor=2026-06-05T00%3A00%3A00.000Z%7Ccaptured-1&method=POST&method=GET&path=%2Fpayments&contentType=json`,
      {
        cache: "no-store",
      }
    )
  })

  it("loads advanced filtered request pages with one search parameter", async () => {
    const parsedSearch = parseAdvancedRequestSearchQuery(
      "method:POST AND headers.x-source:test"
    )

    expect(parsedSearch.kind).toBe("valid")

    if (parsedSearch.kind !== "valid") {
      return
    }

    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(createResponse(createRequestsResponse([])))
    const transport = createFetchEndpointTransport(fetcher)

    await transport.loadRequests(ENDPOINT_ID, {
      search: parsedSearch.value,
    })

    expect(fetcher).toHaveBeenCalledWith(
      `/api/endpoints/${ENDPOINT_ID}/requests?search=method%3APOST+AND+headers.x-source%3Atest`,
      {
        cache: "no-store",
      }
    )
  })

  it("manages endpoint forward targets through the fetch adapter", async () => {
    const createdTarget = createForwardTarget()
    const updatedTarget = createForwardTarget({
      pathMode: "strip",
      updatedAt: "2026-06-05T00:01:00.000Z",
      url: "https://example.com/updated",
    })
    const disabledTarget = createForwardTarget({
      enabled: false,
      updatedAt: "2026-06-05T00:02:00.000Z",
    })
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          endpointId: ENDPOINT_ID,
          targets: [createdTarget],
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          endpointId: ENDPOINT_ID,
          target: createdTarget,
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          endpointId: ENDPOINT_ID,
          target: updatedTarget,
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          endpointId: ENDPOINT_ID,
          target: disabledTarget,
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const transport = createFetchEndpointTransport(fetcher)

    await expect(transport.listForwardTargets(ENDPOINT_ID)).resolves.toEqual([
      createdTarget,
    ])
    await expect(
      transport.createForwardTarget(ENDPOINT_ID, {
        pathMode: "preserve",
        url: "https://example.com/webhook",
      })
    ).resolves.toEqual(createdTarget)
    await expect(
      transport.updateForwardTarget(ENDPOINT_ID, createdTarget.id, {
        pathMode: "strip",
        url: "https://example.com/updated",
      })
    ).resolves.toEqual(updatedTarget)
    await expect(
      transport.updateForwardTarget(ENDPOINT_ID, createdTarget.id, {
        enabled: false,
      })
    ).resolves.toEqual(disabledTarget)
    await expect(
      transport.deleteForwardTarget(ENDPOINT_ID, createdTarget.id)
    ).resolves.toBeUndefined()

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      `/api/endpoints/${ENDPOINT_ID}/forward-targets`,
      {
        cache: "no-store",
      }
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      `/api/endpoints/${ENDPOINT_ID}/forward-targets`,
      {
        body: JSON.stringify({
          pathMode: "preserve",
          url: "https://example.com/webhook",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      `/api/endpoints/${ENDPOINT_ID}/forward-targets/${createdTarget.id}`,
      {
        body: JSON.stringify({
          pathMode: "strip",
          url: "https://example.com/updated",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "PATCH",
      }
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      `/api/endpoints/${ENDPOINT_ID}/forward-targets/${createdTarget.id}`,
      {
        body: JSON.stringify({
          enabled: false,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "PATCH",
      }
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      5,
      `/api/endpoints/${ENDPOINT_ID}/forward-targets/${createdTarget.id}`,
      {
        method: "DELETE",
      }
    )
  })

  it("replays a captured request through the fetch adapter", async () => {
    const replayedRequest = {
      ...createRequest(),
      id: "captured-replay-1",
      receivedAt: "2026-06-05T00:01:00.000Z",
    }
    const fetcher = vi.fn().mockResolvedValueOnce(
      createResponse({
        endpointId: ENDPOINT_ID,
        originalRequestId: "captured-1",
        request: replayedRequest,
      })
    )
    const transport = createFetchEndpointTransport(fetcher)

    await expect(
      transport.replayRequest(ENDPOINT_ID, "captured-1")
    ).resolves.toEqual(replayedRequest)

    expect(fetcher).toHaveBeenCalledWith(
      `/api/endpoints/${ENDPOINT_ID}/requests/captured-1/replay`,
      {
        method: "POST",
      }
    )
  })

  it("surfaces server validation errors for forwarding and replay", async () => {
    const transport = createFetchEndpointTransport(
      vi
        .fn()
        .mockResolvedValueOnce(
          createResponse(
            { error: "Forward URL must use HTTPS." },
            { status: 400 }
          )
        )
        .mockResolvedValueOnce(
          createResponse(
            { error: "Forward URL has already been added." },
            { status: 400 }
          )
        )
        .mockResolvedValueOnce(
          createResponse(
            { error: "Captured request was not found." },
            { status: 404 }
          )
        )
    )

    await expect(
      transport.createForwardTarget(ENDPOINT_ID, {
        url: "http://example.com/webhook",
      })
    ).rejects.toThrow("Forward URL must use HTTPS.")
    await expect(
      transport.updateForwardTarget(ENDPOINT_ID, "forward-target-1", {
        url: "https://example.com/webhook",
      })
    ).rejects.toThrow("Forward URL has already been added.")
    await expect(
      transport.replayRequest(ENDPOINT_ID, "captured-1")
    ).rejects.toThrow("Captured request was not found.")
  })

  it("maps failed responses to stable errors", async () => {
    const transport = createFetchEndpointTransport(
      vi.fn().mockResolvedValue(createResponse({}, { status: 500 }))
    )

    await expect(transport.createEndpoint()).rejects.toThrow(
      "Could not create endpoint."
    )
    await expect(transport.loadEndpoint(ENDPOINT_ID)).rejects.toThrow(
      "Could not load endpoint."
    )
    await expect(transport.loadEndpointStats(ENDPOINT_ID)).rejects.toThrow(
      "Could not load endpoint details."
    )
    await expect(transport.loadRequests(ENDPOINT_ID)).rejects.toThrow(
      "Could not load requests."
    )
    await expect(transport.clearEndpoint(ENDPOINT_ID)).rejects.toThrow(
      "Could not clear endpoint."
    )
    await expect(
      transport.loadEndpointResponseConfig(ENDPOINT_ID)
    ).rejects.toThrow("Could not load response override.")
    await expect(
      transport.saveEndpointResponseOverride(ENDPOINT_ID, {
        status: 200,
        contentType: "text/plain",
        body: "",
      })
    ).rejects.toThrow("Could not save response override.")
    await expect(
      transport.clearEndpointResponseOverride(ENDPOINT_ID)
    ).rejects.toThrow("Could not reset response override.")
    await expect(
      transport.updateEndpointMetadata(ENDPOINT_ID, { name: null })
    ).rejects.toThrow("Could not save endpoint.")
    await expect(transport.listForwardTargets(ENDPOINT_ID)).rejects.toThrow(
      "Could not load forward targets."
    )
    await expect(
      transport.createForwardTarget(ENDPOINT_ID, {
        url: "https://example.com/webhook",
      })
    ).rejects.toThrow("Could not create forward target.")
    await expect(
      transport.updateForwardTarget(ENDPOINT_ID, "forward-target-1", {
        enabled: false,
      })
    ).rejects.toThrow("Could not save forward target.")
    await expect(
      transport.deleteForwardTarget(ENDPOINT_ID, "forward-target-1")
    ).rejects.toThrow("Could not delete forward target.")
    await expect(
      transport.replayRequest(ENDPOINT_ID, "captured-1")
    ).rejects.toThrow("Could not replay request.")
  })
})
