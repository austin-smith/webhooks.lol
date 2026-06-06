import { describe, expect, it } from "vitest"

import {
  mergeCapturedRequest,
  normalizeEndpointNames,
  normalizeEndpointIds,
  reconcileLoadedRequests,
  rememberEndpointId,
  renameEndpoint,
  selectRequest,
  selectRequestId,
} from "@/components/webhook-inspector/endpoint-session/state"
import type { CapturedRequest } from "@/lib/webhooks/types"

function createRequest(id: string): CapturedRequest {
  return {
    id,
    endpointId: "endpoint-id",
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
        "a",
        "",
        "b",
        "a",
        null,
        "c",
        "d",
        "e",
        "f",
        "g",
        "h",
        "i",
      ])
    ).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"])

    expect(rememberEndpointId("new", ["old", "new"])).toEqual([
      "new",
      "old",
    ])
  })

  it("keeps endpoint names only for known webhook endpoint IDs", () => {
    expect(
      normalizeEndpointNames(
        {
          a: "Alpha",
          b: "Beta",
          c: "",
          d: 42,
        },
        new Set(["a", "c", "d"])
      )
    ).toEqual({ a: "Alpha" })
  })

  it("renames and clears the active endpoint name", () => {
    const currentNames = { active: "Old", other: "Other" }

    expect(
      renameEndpoint({
        currentNames,
        name: "New",
        recentEndpointIds: ["other"],
        endpointId: "active",
      })
    ).toEqual({ active: "New", other: "Other" })

    expect(
      renameEndpoint({
        currentNames,
        name: " ",
        recentEndpointIds: ["other"],
        endpointId: "active",
      })
    ).toEqual({ other: "Other" })
  })
})
