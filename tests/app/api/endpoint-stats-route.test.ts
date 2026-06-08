import { beforeEach, describe, expect, it, vi } from "vitest"

const { getEndpointStats } = vi.hoisted(() => ({
  getEndpointStats: vi.fn(),
}))

vi.mock("@/lib/webhooks/repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/webhooks/repository")>()),
  getEndpointStats,
}))

import { GET } from "@/app/api/endpoints/[endpointId]/stats/route"
import { EndpointNotFoundError } from "@/lib/webhooks/repository"

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"

function createContext(endpointId = ENDPOINT_ID) {
  return {
    params: Promise.resolve({ endpointId }),
  } as RouteContext<"/api/endpoints/[endpointId]/stats">
}

describe("endpoint stats route", () => {
  beforeEach(() => {
    getEndpointStats.mockReset()
  })

  it("returns endpoint details", async () => {
    getEndpointStats.mockResolvedValueOnce({
      endpointId: ENDPOINT_ID,
      requestCount: 12,
      bodySizeBytes: 86220,
      createdAt: "2026-06-05T00:00:00.000Z",
      lastActivityAt: "2026-06-05T00:10:00.000Z",
    })

    const response = await GET(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/stats`
      ),
      createContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      endpointId: ENDPOINT_ID,
      requestCount: 12,
      bodySizeBytes: 86220,
      createdAt: "2026-06-05T00:00:00.000Z",
      lastActivityAt: "2026-06-05T00:10:00.000Z",
    })
    expect(getEndpointStats).toHaveBeenCalledWith(ENDPOINT_ID)
  })

  it("rejects malformed endpoint IDs before querying", async () => {
    const response = await GET(
      new Request("https://hooks.example.com/api/endpoints/not-an-id/stats"),
      createContext("not-an-id")
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Invalid endpoint ID.",
    })
    expect(getEndpointStats).not.toHaveBeenCalled()
  })

  it("returns not found for unavailable endpoints", async () => {
    getEndpointStats.mockRejectedValueOnce(
      new EndpointNotFoundError(ENDPOINT_ID)
    )

    const response = await GET(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/stats`
      ),
      createContext()
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Endpoint not found.",
    })
  })
})
