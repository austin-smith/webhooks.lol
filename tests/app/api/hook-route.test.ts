import { beforeEach, describe, expect, it, vi } from "vitest"

const { captureInboundRequest } = vi.hoisted(() => ({
  captureInboundRequest: vi.fn(),
}))

vi.mock("@/lib/webhooks/inbound-capture", () => ({
  captureInboundRequest,
}))

import { OPTIONS } from "@/app/api/hook/[token]/[[...path]]/route"

function createContext(token = "inbox-token") {
  return {
    params: Promise.resolve({ token }),
  } as RouteContext<"/api/hook/[token]/[[...path]]">
}

describe("hook route OPTIONS", () => {
  beforeEach(() => {
    captureInboundRequest.mockReset()
  })

  it("returns CORS preflight responses without capturing", async () => {
    const response = await OPTIONS(
      new Request("https://hooks.example.com/api/hook/inbox-token", {
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
      token: "inbox-token",
    })

    const request = new Request(
      "https://hooks.example.com/api/hook/inbox-token/probe",
      {
        method: "OPTIONS",
      }
    )
    const response = await OPTIONS(request, createContext())

    await expect(response.json()).resolves.toEqual({
      ok: true,
      id: "captured-1",
      token: "inbox-token",
    })
    expect(captureInboundRequest).toHaveBeenCalledWith({
      request,
      token: "inbox-token",
    })
  })
})
