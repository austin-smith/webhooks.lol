import { beforeEach, describe, expect, it, vi } from "vitest"

const { getRequest } = vi.hoisted(() => ({
  getRequest: vi.fn(),
}))

vi.mock("@webhooks-lol/webhooks-server/repository", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@webhooks-lol/webhooks-server/repository")
  >()),
  getRequest,
}))

import { GET } from "@/app/api/endpoints/[endpointId]/requests/[requestId]/route"
import { EndpointNotFoundError } from "@webhooks-lol/webhooks-server/repository"
import type { CapturedRequest } from "@webhooks-lol/webhooks-core/types"

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"
const REQUEST_ID = "22222222-2222-4222-8222-222222222222"

function createContext({
  endpointId = ENDPOINT_ID,
  requestId = REQUEST_ID,
}: {
  endpointId?: string
  requestId?: string
} = {}) {
  return {
    params: Promise.resolve({ endpointId, requestId }),
  } as RouteContext<"/api/endpoints/[endpointId]/requests/[requestId]">
}

function createCapturedRequest(
  overrides: Partial<CapturedRequest> = {}
): CapturedRequest {
  return {
    id: REQUEST_ID,
    endpointId: ENDPOINT_ID,
    method: "POST",
    url: "/payments/created?source=stripe",
    path: "/payments/created",
    query: { source: ["stripe"] },
    headers: { "content-type": "application/json" },
    bodyText: '{"ok":true}',
    bodyBase64: "eyJvayI6dHJ1ZX0=",
    bodySize: 11,
    contentType: "application/json",
    receivedAt: "2026-06-13T12:00:00.000Z",
    ip: "203.0.113.10",
    ...overrides,
  }
}

describe("endpoint request route", () => {
  beforeEach(() => {
    getRequest.mockReset()
  })

  it("returns one captured request", async () => {
    const captured = createCapturedRequest()
    getRequest.mockResolvedValueOnce(captured)

    const response = await GET(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/requests/${REQUEST_ID}`
      ),
      createContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      endpointId: ENDPOINT_ID,
      request: captured,
    })
    expect(getRequest).toHaveBeenCalledWith(ENDPOINT_ID, REQUEST_ID)
  })

  it("rejects malformed endpoint IDs before querying", async () => {
    const response = await GET(
      new Request(
        `https://hooks.example.com/api/endpoints/not-an-id/requests/${REQUEST_ID}`
      ),
      createContext({ endpointId: "not-an-id" })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Invalid endpoint ID.",
    })
    expect(getRequest).not.toHaveBeenCalled()
  })

  it("rejects malformed request IDs before querying", async () => {
    const response = await GET(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/requests/not-an-id`
      ),
      createContext({ requestId: "not-an-id" })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Invalid request id.",
    })
    expect(getRequest).not.toHaveBeenCalled()
  })

  it("returns not found for unavailable endpoints", async () => {
    getRequest.mockRejectedValueOnce(new EndpointNotFoundError(ENDPOINT_ID))

    const response = await GET(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/requests/${REQUEST_ID}`
      ),
      createContext()
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Endpoint not found.",
    })
  })

  it("returns not found when the request is unavailable", async () => {
    getRequest.mockResolvedValueOnce(null)

    const response = await GET(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/requests/${REQUEST_ID}`
      ),
      createContext()
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Request not found.",
    })
  })
})
