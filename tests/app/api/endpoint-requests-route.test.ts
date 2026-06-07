import { beforeEach, describe, expect, it, vi } from "vitest"

const { clearRequests, listRequests, publishEndpointCleared } = vi.hoisted(
  () => ({
    clearRequests: vi.fn(),
    listRequests: vi.fn(),
    publishEndpointCleared: vi.fn(),
  })
)

vi.mock("@/lib/webhooks/repository", () => ({
  clearRequests,
  listRequests,
}))

vi.mock("@/lib/webhooks/endpoint-event-stream", () => ({
  publishEndpointCleared,
}))

import { DELETE, GET } from "@/app/api/endpoints/[endpointId]/requests/route"

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"

function createContext(endpointId = ENDPOINT_ID) {
  return {
    params: Promise.resolve({ endpointId }),
  } as RouteContext<"/api/endpoints/[endpointId]/requests">
}

describe("endpoint requests route", () => {
  beforeEach(() => {
    clearRequests.mockReset()
    listRequests.mockReset()
    publishEndpointCleared.mockReset()
  })

  it("returns a request page with a cursor for older requests", async () => {
    const cursorDate = new Date("2026-06-05T00:00:00.000Z")
    listRequests.mockResolvedValueOnce({
      hasMore: true,
      nextCursor: {
        id: "11111111-1111-4111-8111-111111111111",
        receivedAt: cursorDate,
      },
      requests: [],
    })

    const response = await GET(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/requests?limit=25&cursor=2026-06-06T00%3A00%3A00.000Z%7C22222222-2222-4222-8222-222222222222`
      ),
      createContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      endpointId: ENDPOINT_ID,
      page: {
        hasMore: true,
        nextCursor:
          "2026-06-05T00:00:00.000Z|11111111-1111-4111-8111-111111111111",
      },
      requests: [],
    })
    expect(listRequests).toHaveBeenCalledWith(ENDPOINT_ID, {
      cursor: {
        id: "22222222-2222-4222-8222-222222222222",
        receivedAt: new Date("2026-06-06T00:00:00.000Z"),
      },
      limit: 25,
    })
  })

  it("rejects malformed cursors before querying", async () => {
    const response = await GET(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/requests?cursor=bad`
      ),
      createContext()
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Invalid request page cursor.",
    })
    expect(listRequests).not.toHaveBeenCalled()
  })

  it("rejects cursors with non-UUID request IDs before querying", async () => {
    const response = await GET(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/requests?cursor=2026-06-06T00%3A00%3A00.000Z%7Cnot-a-uuid`
      ),
      createContext()
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Invalid request page cursor.",
    })
    expect(listRequests).not.toHaveBeenCalled()
  })

  it("clears captured requests and returns an empty page", async () => {
    const response = await DELETE(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/requests`,
        {
          method: "DELETE",
        }
      ),
      createContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      endpointId: ENDPOINT_ID,
      page: {
        hasMore: false,
        nextCursor: null,
      },
      requests: [],
    })
    expect(clearRequests).toHaveBeenCalledWith(ENDPOINT_ID)
    expect(publishEndpointCleared).toHaveBeenCalledWith(ENDPOINT_ID)
  })
})
