import { Buffer } from "node:buffer"

import { describe, expect, it } from "vitest"

import {
  buildEndpointForwardBody,
  buildEndpointForwardHeaders,
  buildEndpointForwardTargetUrl,
} from "@/lib/webhooks/endpoint-forwarding/delivery-request"
import type { CapturedRequest } from "@/lib/webhooks/types"

function createRequest(overrides: Partial<CapturedRequest> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    endpointId: "22222222-2222-4222-8222-222222222222",
    method: "POST",
    url: "/stripe/events?source=test",
    path: "/stripe/events",
    query: { source: ["test"], tag: ["a", "b"] },
    headers: {
      connection: "keep-alive",
      "content-length": "13",
      "content-type": "application/json",
      host: "webhooks.lol",
      "stripe-signature": "t=1,v1=abc",
    },
    bodyBase64: Buffer.from('{"ok":true}').toString("base64"),
    bodySize: 11,
    bodyText: '{"ok":true}',
    contentType: "application/json",
    ip: "203.0.113.7",
    receivedAt: "2026-06-13T12:00:00.000Z",
    ...overrides,
  } satisfies CapturedRequest
}

describe("endpoint forwarding request shape", () => {
  it("strips the captured path by default while preserving query values", () => {
    const url = buildEndpointForwardTargetUrl({
      pathMode: "strip",
      request: createRequest({
        query: { a: ["1", "3"], b: ["2"], x: ["a b"] },
        url: "/stripe/events?a=1&b=2&a=3&x=a%20b",
      }),
      targetUrl: "https://app.example.com/webhooks/stripe?existing=1",
    })

    expect(url.toString()).toBe(
      "https://app.example.com/webhooks/stripe?existing=1&a=1&b=2&a=3&x=a%20b"
    )
  })

  it("can preserve the captured path below the configured target path", () => {
    const url = buildEndpointForwardTargetUrl({
      pathMode: "preserve",
      request: createRequest(),
      targetUrl: "https://app.example.com/webhooks",
    })

    expect(url.pathname).toBe("/webhooks/stripe/events")
  })

  it("forwards signature headers and drops hop-by-hop headers", () => {
    const headers = buildEndpointForwardHeaders({
      attempt: 2,
      deliveryId: "33333333-3333-4333-8333-333333333333",
      request: createRequest(),
    })

    expect(headers.get("stripe-signature")).toBe("t=1,v1=abc")
    expect(headers.get("content-type")).toBe("application/json")
    expect(headers.get("host")).toBeNull()
    expect(headers.get("content-length")).toBeNull()
    expect(headers.get("connection")).toBeNull()
    expect(headers.get("x-webhookslol-attempt")).toBe("2")
    expect(headers.get("x-webhookslol-delivery-id")).toBe(
      "33333333-3333-4333-8333-333333333333"
    )
  })

  it("reconstructs exact body bytes from the stored base64 payload", () => {
    const body = buildEndpointForwardBody(createRequest())

    expect(body && Buffer.from(body).toString("utf8")).toBe('{"ok":true}')
  })

  it("omits bodies for GET and HEAD", () => {
    expect(buildEndpointForwardBody(createRequest({ method: "GET" }))).toBe(
      undefined
    )
    expect(buildEndpointForwardBody(createRequest({ method: "HEAD" }))).toBe(
      undefined
    )
  })
})
