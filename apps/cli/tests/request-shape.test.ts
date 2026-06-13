import { Buffer } from "node:buffer"

import { describe, expect, it } from "vitest"

import {
  buildForwardHeaders,
  buildRequestBody,
  buildTargetUrl,
} from "../src/core/request-shape.js"
import type { CapturedRequest } from "../src/core/types.js"

function makeRequest(
  overrides: Partial<CapturedRequest> = {}
): CapturedRequest {
  return {
    id: "11111111-1111-1111-8111-111111111111",
    endpointId: "22222222-2222-2222-8222-222222222222",
    method: "POST",
    url: "/payments/created?source=stripe",
    path: "/payments/created",
    query: { source: ["stripe"] },
    headers: {
      "content-type": "application/json",
      "stripe-signature": "t=1,v1=abc",
      host: "webhooks.lol",
      "content-length": "13",
      connection: "keep-alive",
    },
    bodyText: '{"amount":42}',
    bodyBase64: Buffer.from('{"amount":42}').toString("base64"),
    bodySize: 13,
    contentType: "application/json",
    receivedAt: "2026-06-13T12:00:00.000Z",
    ip: "203.0.113.9",
    ...overrides,
  }
}

describe("buildTargetUrl", () => {
  it("appends the captured subpath in preserve mode", () => {
    const url = buildTargetUrl(
      "http://localhost:3000/api/stripe",
      makeRequest(),
      "preserve"
    )
    expect(url.pathname).toBe("/api/stripe/payments/created")
    expect(url.searchParams.get("source")).toBe("stripe")
  })

  it("uses the target path verbatim in strip mode", () => {
    const url = buildTargetUrl(
      "http://localhost:3000/api/stripe",
      makeRequest(),
      "strip"
    )
    expect(url.pathname).toBe("/api/stripe")
  })

  it("does not append a root subpath", () => {
    const url = buildTargetUrl(
      "http://localhost:3000/hook",
      makeRequest({ path: "/", query: {} }),
      "preserve"
    )
    expect(url.pathname).toBe("/hook")
  })

  it("preserves repeated query values", () => {
    const url = buildTargetUrl(
      "http://localhost:3000/",
      makeRequest({ query: { tag: ["a", "b"] }, path: "/" }),
      "preserve"
    )
    expect(url.searchParams.getAll("tag")).toEqual(["a", "b"])
  })
})

describe("buildForwardHeaders", () => {
  it("drops hop-by-hop headers and keeps signatures", () => {
    const headers = buildForwardHeaders(makeRequest())
    expect(headers.get("host")).toBeNull()
    expect(headers.get("content-length")).toBeNull()
    expect(headers.get("connection")).toBeNull()
    expect(headers.get("content-type")).toBe("application/json")
    expect(headers.get("stripe-signature")).toBe("t=1,v1=abc")
  })

  it("adds provenance headers", () => {
    const request = makeRequest()
    const headers = buildForwardHeaders(request)
    expect(headers.get("x-webhookslol-endpoint")).toBe(request.endpointId)
    expect(headers.get("x-webhookslol-request-id")).toBe(request.id)
    expect(headers.get("x-webhookslol-received-at")).toBe(request.receivedAt)
  })
})

describe("buildRequestBody", () => {
  it("reconstructs exact bytes from base64", () => {
    const body = buildRequestBody(makeRequest())
    expect(body && Buffer.from(body).toString()).toBe('{"amount":42}')
  })

  it("omits the body for GET and HEAD", () => {
    expect(buildRequestBody(makeRequest({ method: "GET" }))).toBeUndefined()
    expect(buildRequestBody(makeRequest({ method: "HEAD" }))).toBeUndefined()
  })

  it("preserves binary payloads", () => {
    const bytes = Uint8Array.from([0, 1, 2, 255, 254])
    const body = buildRequestBody(
      makeRequest({ bodyBase64: Buffer.from(bytes).toString("base64") })
    )
    expect(body && [...body]).toEqual([0, 1, 2, 255, 254])
  })
})
