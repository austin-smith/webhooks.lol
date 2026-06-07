import { describe, expect, it } from "vitest"

import {
  mergeCapturedRequestPage,
  mergeCapturedRequest,
  normalizeEndpointIds,
  reconcileLoadedRequests,
  rememberEndpointId,
  selectRequest,
  selectRequestId,
} from "@/components/webhook-inspector/endpoint-session/state"
import type { CapturedRequest } from "@/lib/webhooks/types"

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"
const OTHER_ENDPOINT_ID = "22222222-2222-4222-8222-222222222222"
const THIRD_ENDPOINT_ID = "33333333-3333-4333-8333-333333333333"
const FOURTH_ENDPOINT_ID = "44444444-4444-4444-8444-444444444444"
const FIFTH_ENDPOINT_ID = "55555555-5555-4555-8555-555555555555"
const SIXTH_ENDPOINT_ID = "66666666-6666-4666-8666-666666666666"
const SEVENTH_ENDPOINT_ID = "77777777-7777-4777-8777-777777777777"
const EIGHTH_ENDPOINT_ID = "88888888-8888-4888-8888-888888888888"
const NINTH_ENDPOINT_ID = "99999999-9999-4999-8999-999999999999"

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
    expect(
      normalizeEndpointIds([
        ENDPOINT_ID.toUpperCase(),
        "",
        OTHER_ENDPOINT_ID,
        ENDPOINT_ID,
        null,
        "not-an-endpoint-id",
        THIRD_ENDPOINT_ID,
        FOURTH_ENDPOINT_ID,
        FIFTH_ENDPOINT_ID,
        SIXTH_ENDPOINT_ID,
        SEVENTH_ENDPOINT_ID,
        EIGHTH_ENDPOINT_ID,
        NINTH_ENDPOINT_ID,
      ])
    ).toEqual([
      ENDPOINT_ID,
      OTHER_ENDPOINT_ID,
      THIRD_ENDPOINT_ID,
      FOURTH_ENDPOINT_ID,
      FIFTH_ENDPOINT_ID,
      SIXTH_ENDPOINT_ID,
      SEVENTH_ENDPOINT_ID,
      EIGHTH_ENDPOINT_ID,
    ])

    expect(rememberEndpointId(OTHER_ENDPOINT_ID, [ENDPOINT_ID])).toEqual([
      OTHER_ENDPOINT_ID,
      ENDPOINT_ID,
    ])
  })
})
