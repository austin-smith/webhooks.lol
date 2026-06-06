import { beforeEach, describe, expect, it, vi } from "vitest"

const { captureInboundRequest } = vi.hoisted(() => ({
  captureInboundRequest: vi.fn(),
}))

vi.mock("@/lib/webhooks/inbound-capture", () => ({ captureInboundRequest }))

import {
  HEAD,
  OPTIONS,
  POST,
} from "@/app/api/hook/[endpointId]/[[...path]]/route"
import { DEFAULT_ENDPOINT_RESPONSE_CONFIG } from "@/lib/webhooks/endpoint-response"

function createContext(endpointId = "endpoint-id") {
  return {
    params: Promise.resolve({ endpointId }),
  } as RouteContext<"/api/hook/[endpointId]/[[...path]]">
}

describe("hook route OPTIONS", () => {
  beforeEach(() => {
    captureInboundRequest.mockReset()
  })

  it("returns CORS preflight responses without capturing", async () => {
    const response = await OPTIONS(
      new Request("https://hooks.example.com/api/hook/endpoint-id", {
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
    expect(captureInboundRequest).not.toHaveBeenCalled()
  })

  it("captures non-preflight OPTIONS requests", async () => {
    captureInboundRequest.mockResolvedValueOnce({
      kind: "captured",
      id: "captured-1",
      response: DEFAULT_ENDPOINT_RESPONSE_CONFIG,
      endpointId: "endpoint-id",
    })

    const request = new Request(
      "https://hooks.example.com/api/hook/endpoint-id/probe",
      {
        method: "OPTIONS",
      }
    )
    const response = await OPTIONS(request, createContext())

    await expect(response.json()).resolves.toEqual({
      ok: true,
      id: "captured-1",
      endpointId: "endpoint-id",
    })
    expect(captureInboundRequest).toHaveBeenCalledWith({
      request,
      endpointId: "endpoint-id",
    })
  })
})

describe("hook route responses", () => {
  beforeEach(() => {
    captureInboundRequest.mockReset()
  })

  it("preserves default success responses when no override exists", async () => {
    captureInboundRequest.mockResolvedValueOnce({
      kind: "captured",
      id: "captured-1",
      response: DEFAULT_ENDPOINT_RESPONSE_CONFIG,
      endpointId: "endpoint-id",
    })

    const response = await POST(
      new Request("https://hooks.example.com/api/hook/endpoint-id", {
        method: "POST",
      }),
      createContext()
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({
      ok: true,
      id: "captured-1",
      endpointId: "endpoint-id",
    })
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
      endpointId: "endpoint-id",
    })

    const response = await POST(
      new Request("https://hooks.example.com/api/hook/endpoint-id", {
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
      endpointId: "endpoint-id",
    })

    const response = await POST(
      new Request("https://hooks.example.com/api/hook/endpoint-id", {
        method: "POST",
      }),
      createContext()
    )

    expect(response.status).toBe(202)
    await expect(response.text()).resolves.toBe(
      '{"id":"captured-1","endpointId":"endpoint-id"}'
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
      endpointId: "endpoint-id",
    })

    const response = await HEAD(
      new Request("https://hooks.example.com/api/hook/endpoint-id", {
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
      new Request("https://hooks.example.com/api/hook/endpoint-id", {
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
