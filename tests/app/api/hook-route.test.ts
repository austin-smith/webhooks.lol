import { beforeEach, describe, expect, it, vi } from "vitest"

const { captureInboundRequest, checkWebhookCaptureAdmission } = vi.hoisted(
  () => ({
    captureInboundRequest: vi.fn(),
    checkWebhookCaptureAdmission: vi.fn(),
  })
)

vi.mock("@/lib/webhooks/admission-control", () => ({
  checkWebhookCaptureAdmission,
}))

vi.mock("@/lib/webhooks/inbound-capture", () => ({ captureInboundRequest }))

import {
  HEAD,
  OPTIONS,
  POST,
} from "@/app/api/hook/[endpointId]/[[...path]]/route"
import { DEFAULT_ENDPOINT_RESPONSE_CONFIG } from "@/lib/webhooks/endpoint-response"

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"

function createAllowedAdmission() {
  return {
    kind: "allowed" as const,
    clientIdentity: {
      key: "client:test",
      keyHash: null,
      source: "global" as const,
    },
  }
}

function createDeniedAdmission() {
  return {
    kind: "denied" as const,
    rateLimit: {
      limit: 1,
      policyId: "webhook-capture-client",
      remaining: 0,
      resetSeconds: 60,
      retryAfterSeconds: 60,
      windowSeconds: 60,
    },
  }
}

function createContext(endpointId = ENDPOINT_ID) {
  return {
    params: Promise.resolve({ endpointId }),
  } as RouteContext<"/api/hook/[endpointId]/[[...path]]">
}

describe("hook route OPTIONS", () => {
  beforeEach(() => {
    captureInboundRequest.mockReset()
    checkWebhookCaptureAdmission.mockReset()
    checkWebhookCaptureAdmission.mockResolvedValue(createAllowedAdmission())
  })

  it("returns CORS preflight responses without capturing", async () => {
    const response = await OPTIONS(
      new Request(`https://hooks.example.com/api/hook/${ENDPOINT_ID}`, {
        method: "OPTIONS",
        headers: {
          "access-control-request-method": "POST",
          origin: "https://client.example.com",
        },
      }),
      createContext()
    )

    expect(response.status).toBe(204)
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
      "OPTIONS"
    )
    expect(checkWebhookCaptureAdmission).not.toHaveBeenCalled()
    expect(captureInboundRequest).not.toHaveBeenCalled()
  })

  it("captures non-preflight OPTIONS requests", async () => {
    captureInboundRequest.mockResolvedValueOnce({
      kind: "captured",
      id: "captured-1",
      response: DEFAULT_ENDPOINT_RESPONSE_CONFIG,
      endpointId: ENDPOINT_ID,
    })

    const request = new Request(
      `https://hooks.example.com/api/hook/${ENDPOINT_ID}/probe`,
      {
        method: "OPTIONS",
      }
    )
    const response = await OPTIONS(request, createContext())

    await expect(response.json()).resolves.toEqual({
      ok: true,
      id: "captured-1",
      endpointId: ENDPOINT_ID,
    })
    expect(captureInboundRequest).toHaveBeenCalledWith({
      request,
      endpointId: ENDPOINT_ID,
    })
  })
})

describe("hook route responses", () => {
  beforeEach(() => {
    captureInboundRequest.mockReset()
    checkWebhookCaptureAdmission.mockReset()
    checkWebhookCaptureAdmission.mockResolvedValue(createAllowedAdmission())
  })

  it("preserves default success responses when no override exists", async () => {
    captureInboundRequest.mockResolvedValueOnce({
      kind: "captured",
      id: "captured-1",
      response: DEFAULT_ENDPOINT_RESPONSE_CONFIG,
      endpointId: ENDPOINT_ID,
    })

    const response = await POST(
      new Request(`https://hooks.example.com/api/hook/${ENDPOINT_ID}`, {
        method: "POST",
      }),
      createContext()
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({
      ok: true,
      id: "captured-1",
      endpointId: ENDPOINT_ID,
    })
  })

  it("rejects captures when the request-rate policy is exhausted", async () => {
    checkWebhookCaptureAdmission.mockResolvedValueOnce(createDeniedAdmission())

    const response = await POST(
      new Request(`https://hooks.example.com/api/hook/${ENDPOINT_ID}`, {
        method: "POST",
      }),
      createContext()
    )

    expect(response.status).toBe(429)
    expect(response.headers.get("access-control-allow-origin")).toBe("*")
    expect(response.headers.get("retry-after")).toBe("60")
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Rate limit exceeded.",
      retryAfterSeconds: 60,
    })
    expect(captureInboundRequest).not.toHaveBeenCalled()
  })

  it("returns custom response overrides after capture", async () => {
    captureInboundRequest.mockResolvedValueOnce({
      kind: "captured",
      id: "captured-1",
      response: {
        mode: "custom",
        status: 201,
        contentType: "application/json",
        body: '{"accepted":true}',
      },
      endpointId: ENDPOINT_ID,
    })

    const response = await POST(
      new Request(`https://hooks.example.com/api/hook/${ENDPOINT_ID}`, {
        method: "POST",
      }),
      createContext()
    )

    expect(response.status).toBe(201)
    expect(response.headers.get("content-type")).toBe("application/json")
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.text()).resolves.toBe('{"accepted":true}')
  })

  it("renders supported variables in custom response bodies", async () => {
    captureInboundRequest.mockResolvedValueOnce({
      kind: "captured",
      id: "captured-1",
      response: {
        mode: "custom",
        status: 202,
        contentType: "application/json",
        body: '{"id":"{{request.id}}","endpointId":"{{endpoint.id}}"}',
      },
      endpointId: ENDPOINT_ID,
    })

    const response = await POST(
      new Request(`https://hooks.example.com/api/hook/${ENDPOINT_ID}`, {
        method: "POST",
      }),
      createContext()
    )

    expect(response.status).toBe(202)
    await expect(response.text()).resolves.toBe(
      `{"id":"captured-1","endpointId":"${ENDPOINT_ID}"}`
    )
  })

  it("never sends a response body for HEAD requests", async () => {
    captureInboundRequest.mockResolvedValueOnce({
      kind: "captured",
      id: "captured-1",
      response: {
        mode: "custom",
        status: 202,
        contentType: "text/plain",
        body: "accepted",
      },
      endpointId: ENDPOINT_ID,
    })

    const response = await HEAD(
      new Request(`https://hooks.example.com/api/hook/${ENDPOINT_ID}`, {
        method: "HEAD",
      }),
      createContext()
    )

    expect(response.status).toBe(202)
    await expect(response.text()).resolves.toBe("")
  })

  it("does not apply custom overrides to body-too-large errors", async () => {
    captureInboundRequest.mockResolvedValueOnce({
      kind: "body-too-large",
      maxBodyBytes: 1048576,
    })

    const response = await POST(
      new Request(`https://hooks.example.com/api/hook/${ENDPOINT_ID}`, {
        method: "POST",
      }),
      createContext()
    )

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Request body too large.",
      maxBodyBytes: 1048576,
    })
  })
})
