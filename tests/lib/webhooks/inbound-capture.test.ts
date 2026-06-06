import { describe, expect, it, vi } from "vitest"

import { createInboundCapture } from "@/lib/webhooks/inbound-capture"
import { DEFAULT_INBOX_RESPONSE_CONFIG } from "@/lib/webhooks/inbox-response"
import type { CapturedRequest } from "@/lib/webhooks/types"

function createCapturedRequest(
  input: Omit<CapturedRequest, "id" | "receivedAt">
): CapturedRequest {
  return {
    ...input,
    id: "captured-1",
    receivedAt: "2026-06-05T00:00:00.000Z",
  }
}

describe("createInboundCapture", () => {
  it("captures request data and publishes after saving", async () => {
    const calls: string[] = []
    const saveCapturedRequest = vi.fn(async (input) => {
      calls.push("save")
      return createCapturedRequest(input)
    })
    const publishRequest = vi.fn(() => {
      calls.push("publish")
    })
    const getInboxResponseConfig = vi.fn(async () => {
      calls.push("response")
      return DEFAULT_INBOX_RESPONSE_CONFIG
    })
    const captureInboundRequest = createInboundCapture({
      getInboxResponseConfig,
      publishRequest,
      saveCapturedRequest,
    })

    const outcome = await captureInboundRequest({
      token: "inbox-token",
      request: new Request(
        "https://hooks.example.com/api/hook/inbox-token/payments/created?foo=one&foo=two",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "203.0.113.7, 10.0.0.2",
          },
          body: JSON.stringify({ event: "payment.created", amount: 42 }),
        }
      ),
    })

    expect(outcome).toEqual({
      kind: "captured",
      id: "captured-1",
      response: DEFAULT_INBOX_RESPONSE_CONFIG,
      token: "inbox-token",
    })
    expect(saveCapturedRequest).toHaveBeenCalledWith({
      token: "inbox-token",
      method: "POST",
      url: "/payments/created?foo=one&foo=two",
      path: "/payments/created",
      query: { foo: ["one", "two"] },
      headers: expect.objectContaining({
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.7, 10.0.0.2",
      }),
      bodyText: '{"event":"payment.created","amount":42}',
      bodyBase64: "eyJldmVudCI6InBheW1lbnQuY3JlYXRlZCIsImFtb3VudCI6NDJ9",
      bodySize: 39,
      contentType: "application/json",
      ip: "203.0.113.7",
    })
    expect(publishRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: "captured-1", token: "inbox-token" })
    )
    expect(getInboxResponseConfig).toHaveBeenCalledWith("inbox-token")
    expect(calls).toEqual(["save", "publish", "response"])
  })

  it("returns body-too-large without saving or publishing", async () => {
    const saveCapturedRequest = vi.fn(async (input) =>
      createCapturedRequest(input)
    )
    const publishRequest = vi.fn()
    const getInboxResponseConfig = vi.fn(
      async () => DEFAULT_INBOX_RESPONSE_CONFIG
    )
    const captureInboundRequest = createInboundCapture({
      getInboxResponseConfig,
      publishRequest,
      saveCapturedRequest,
    })

    const outcome = await captureInboundRequest({
      token: "inbox-token",
      request: new Request("https://hooks.example.com/api/hook/inbox-token", {
        method: "POST",
        headers: {
          "content-length": "1048577",
          "content-type": "text/plain",
        },
        body: "too large by header",
      }),
    })

    expect(outcome).toEqual({
      kind: "body-too-large",
      maxBodyBytes: 1048576,
    })
    expect(saveCapturedRequest).not.toHaveBeenCalled()
    expect(publishRequest).not.toHaveBeenCalled()
    expect(getInboxResponseConfig).not.toHaveBeenCalled()
  })

  it("captures binary bodies as base64 without body text", async () => {
    const saveCapturedRequest = vi.fn(async (input) =>
      createCapturedRequest(input)
    )
    const captureInboundRequest = createInboundCapture({
      getInboxResponseConfig: vi.fn(async () => DEFAULT_INBOX_RESPONSE_CONFIG),
      publishRequest: vi.fn(),
      saveCapturedRequest,
    })

    await captureInboundRequest({
      token: "inbox-token",
      request: new Request("https://hooks.example.com/api/hook/inbox-token", {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
        },
        body: new Uint8Array([1, 2, 3]),
      }),
    })

    expect(saveCapturedRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyText: "",
        bodyBase64: "AQID",
        bodySize: 3,
        contentType: "application/octet-stream",
      })
    )
  })
})
