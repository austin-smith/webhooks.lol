import { describe, expect, it } from "vitest"

import {
  MAX_RECENT_ENDPOINTS,
  mergeForwardTarget,
  mergeCapturedRequestPage,
  mergeCapturedRequest,
  normalizeEndpointIds,
  reconcileLoadedRequests,
  rememberEndpointId,
  removeEndpointId,
  removeForwardTarget,
  replaceForwardTarget,
  selectRequest,
  selectRequestId,
} from "@/components/webhook-inspector/endpoint-session/state"
import type { EndpointForwardTarget } from "@/components/webhook-inspector/endpoint-session/transport"
import type { CapturedRequest } from "@webhooks-lol/webhooks-core/types"

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"

function createEndpointId(index: number) {
  const segment = index.toString().padStart(4, "0")
  const suffix = index.toString().padStart(12, "0")

  return `${segment}${segment}-${segment}-4${segment.slice(1)}-8${segment.slice(1)}-${suffix}`
}

function createRequest(id: string): CapturedRequest {
  return {
    id,
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
    receivedAt: `2026-06-05T00:00:0${id}.000Z`,
    ip: null,
  }
}

function createForwardTarget(
  id: string,
  overrides: Partial<EndpointForwardTarget> = {}
): EndpointForwardTarget {
  return {
    id,
    endpointId: ENDPOINT_ID,
    url: `https://example.com/${id}`,
    pathMode: "preserve",
    enabled: true,
    deleted: false,
    createdAt: `2026-06-05T00:00:0${id}.000Z`,
    updatedAt: `2026-06-05T00:00:0${id}.000Z`,
    ...overrides,
  }
}

describe("endpoint session state", () => {
  it("keeps selection when the selected request still exists", () => {
    const requests = [createRequest("1"), createRequest("2")]

    expect(selectRequest(requests, "2")?.id).toBe("2")
    expect(selectRequestId(requests, "2")).toBe("2")
  })

  it("falls back to the first request when selection disappears", () => {
    const requests = [createRequest("1"), createRequest("2")]

    expect(selectRequest(requests, "missing")?.id).toBe("1")
    expect(selectRequestId(requests, "missing")).toBe("1")
    expect(selectRequest([], "missing")).toBeNull()
    expect(selectRequestId([], "missing")).toBeNull()
  })

  it("moves live requests to the top without duplicating them", () => {
    const first = createRequest("1")
    const second = createRequest("2")
    const replacement = { ...first, method: "PATCH" }

    expect(mergeCapturedRequest([first, second], replacement)).toEqual([
      replacement,
      second,
    ])
  })

  it("merges older request pages without duplicating or breaking order", () => {
    const newest = createRequest("3")
    const duplicate = createRequest("2")
    const oldest = createRequest("1")

    expect(
      mergeCapturedRequestPage([newest, duplicate], [duplicate, oldest])
    ).toEqual([newest, duplicate, oldest])
  })

  it("merges forward targets without duplicating or breaking creation order", () => {
    const newest = createForwardTarget("3")
    const middle = createForwardTarget("2")
    const oldest = createForwardTarget("1")
    const replacement = {
      ...middle,
      enabled: false,
      url: "https://updated.example.com/webhook",
      updatedAt: "2026-06-05T00:01:00.000Z",
    }

    expect(mergeForwardTarget([newest, middle], oldest)).toEqual([
      oldest,
      middle,
      newest,
    ])
    expect(mergeForwardTarget([oldest, middle, newest], replacement)).toEqual([
      oldest,
      replacement,
      newest,
    ])
  })

  it("replaces forward targets while preserving target order", () => {
    const first = createForwardTarget("1")
    const second = createForwardTarget("2")
    const replacement = {
      ...second,
      pathMode: "strip" as const,
      updatedAt: "2026-06-05T00:01:00.000Z",
    }

    expect(replaceForwardTarget([first, second], replacement)).toEqual([
      first,
      replacement,
    ])
    expect(replaceForwardTarget([first], replacement)).toEqual([first])
  })

  it("removes forward targets by id", () => {
    const first = createForwardTarget("1")
    const second = createForwardTarget("2")

    expect(removeForwardTarget([first, second], first.id)).toEqual([second])
    expect(removeForwardTarget([first], second.id)).toEqual([first])
  })

  it("preserves live requests received while a server load is in flight", () => {
    const loadedRequest = createRequest("1")
    const liveRequest = createRequest("3")

    expect(
      reconcileLoadedRequests({
        currentRequests: [liveRequest],
        loadedRequests: [loadedRequest],
        requestIdsAtLoadStart: new Set(),
      })
    ).toEqual([liveRequest, loadedRequest])
  })

  it("drops requests that were already present when a server load started", () => {
    const staleRequest = createRequest("1")

    expect(
      reconcileLoadedRequests({
        currentRequests: [staleRequest],
        loadedRequests: [],
        requestIdsAtLoadStart: new Set([staleRequest.id]),
      })
    ).toEqual([])
  })

  it("normalizes recent webhook endpoint IDs", () => {
    const firstEndpointId = createEndpointId(1)
    const secondEndpointId = createEndpointId(2)
    const endpointIds = [
      firstEndpointId,
      secondEndpointId,
      ...Array.from({ length: MAX_RECENT_ENDPOINTS - 1 }, (_value, index) =>
        createEndpointId(index + 3)
      ),
    ]

    expect(
      normalizeEndpointIds([
        firstEndpointId.toUpperCase(),
        "",
        secondEndpointId,
        firstEndpointId,
        null,
        "not-an-endpoint-id",
        ...endpointIds.slice(2),
      ])
    ).toEqual(endpointIds.slice(0, MAX_RECENT_ENDPOINTS))

    expect(
      rememberEndpointId(secondEndpointId, [firstEndpointId, secondEndpointId])
    ).toEqual([firstEndpointId, secondEndpointId])

    expect(rememberEndpointId(secondEndpointId, [firstEndpointId])).toEqual([
      secondEndpointId,
      firstEndpointId,
    ])
    expect(
      removeEndpointId(firstEndpointId, [firstEndpointId, secondEndpointId])
    ).toEqual([secondEndpointId])
  })
})
