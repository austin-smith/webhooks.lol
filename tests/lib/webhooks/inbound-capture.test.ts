import { describe, expect, it, vi } from "vitest"

import { createInboundCapture } from "@/lib/webhooks/inbound-capture"
import { DEFAULT_ENDPOINT_RESPONSE_CONFIG } from "@/lib/webhooks/endpoint-response"
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
    const getEndpointResponseConfig = vi.fn(async () => {
      calls.push("response")
      return DEFAULT_ENDPOINT_RESPONSE_CONFIG
    })
    const checkWebhookCaptureBodyAdmission = vi.fn(async () => {
      calls.push("admission")
      return {
        kind: "allowed" as const,
        clientIdentity: {
          key: "client:test",
          keyHash: null,
          source: "global" as const,
        },
      }
    })
    const captureInboundRequest = createInboundCapture({
      checkWebhookCaptureBodyAdmission,
      getEndpointResponseConfig,
      publishRequest,
      saveCapturedRequest,
    })

    const outcome = await captureInboundRequest({
      endpointId: "endpoint-id",
      request: new Request(
        "https://hooks.example.com/api/hook/endpoint-id/payments/created?foo=one&foo=two",
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
      response: DEFAULT_ENDPOINT_RESPONSE_CONFIG,
      endpointId: "endpoint-id",
    })
    expect(saveCapturedRequest).toHaveBeenCalledWith({
      endpointId: "endpoint-id",
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
    expect(checkWebhookCaptureBodyAdmission).toHaveBeenCalledWith({
      bodySize: 39,
      endpointId: "endpoint-id",
      request: expect.any(Request),
    })
    expect(publishRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "captured-1",
        endpointId: "endpoint-id",
      })
    )
    expect(getEndpointResponseConfig).toHaveBeenCalledWith("endpoint-id")
    expect(calls).toEqual(["admission", "save", "publish", "response"])
  })

  it("returns body-too-large without saving or publishing", async () => {
    const saveCapturedRequest = vi.fn(async (input) =>
      createCapturedRequest(input)
    )
    const publishRequest = vi.fn()
    const getEndpointResponseConfig = vi.fn(
      async () => DEFAULT_ENDPOINT_RESPONSE_CONFIG
    )
    const captureInboundRequest = createInboundCapture({
      getEndpointResponseConfig,
      publishRequest,
      saveCapturedRequest,
    })

    const outcome = await captureInboundRequest({
      endpointId: "endpoint-id",
      request: new Request("https://hooks.example.com/api/hook/endpoint-id", {
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
    expect(getEndpointResponseConfig).not.toHaveBeenCalled()
  })

  it("captures binary bodies as base64 without body text", async () => {
    const saveCapturedRequest = vi.fn(async (input) =>
      createCapturedRequest(input)
    )
    const captureInboundRequest = createInboundCapture({
      getEndpointResponseConfig: vi.fn(
        async () => DEFAULT_ENDPOINT_RESPONSE_CONFIG
      ),
      publishRequest: vi.fn(),
      saveCapturedRequest,
    })

    await captureInboundRequest({
      endpointId: "endpoint-id",
      request: new Request("https://hooks.example.com/api/hook/endpoint-id", {
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

  it("returns rate-limited without saving or publishing", async () => {
    const saveCapturedRequest = vi.fn(async (input) =>
      createCapturedRequest(input)
    )
    const publishRequest = vi.fn()
    const getEndpointResponseConfig = vi.fn(
      async () => DEFAULT_ENDPOINT_RESPONSE_CONFIG
    )
    const captureInboundRequest = createInboundCapture({
      checkWebhookCaptureBodyAdmission: vi.fn(async () => ({
        kind: "denied" as const,
        rateLimit: {
          limit: 1,
          policyId: "webhook-capture-bytes-endpoint",
          remaining: 0,
          resetSeconds: 60,
          retryAfterSeconds: 60,
          windowSeconds: 60,
        },
      })),
      getEndpointResponseConfig,
      publishRequest,
      saveCapturedRequest,
    })

    const outcome = await captureInboundRequest({
      endpointId: "endpoint-id",
      request: new Request("https://hooks.example.com/api/hook/endpoint-id", {
        method: "POST",
        body: "too many bytes today",
      }),
    })

    expect(outcome).toEqual({
      kind: "rate-limited",
      rateLimit: {
        limit: 1,
        policyId: "webhook-capture-bytes-endpoint",
        remaining: 0,
        resetSeconds: 60,
        retryAfterSeconds: 60,
        windowSeconds: 60,
      },
    })
    expect(saveCapturedRequest).not.toHaveBeenCalled()
    expect(publishRequest).not.toHaveBeenCalled()
    expect(getEndpointResponseConfig).not.toHaveBeenCalled()
  })
})
