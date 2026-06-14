import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiError, getRequest, replayRequest } from "../src/core/api-client.js"
import type { CapturedRequest } from "../src/core/types.js"

const endpointId = "11111111-1111-4111-8111-111111111111"
const requestId = "22222222-2222-4222-8222-222222222222"

afterEach(() => {
  vi.unstubAllGlobals()
})

function createRequest(): CapturedRequest {
  return {
    id: requestId,
    endpointId,
    method: "POST",
    url: "/hook",
    path: "/hook",
    query: {},
    headers: {},
    bodyText: "",
    bodyBase64: "",
    bodySize: 0,
    contentType: null,
    receivedAt: "2026-06-13T12:00:00.000Z",
    ip: null,
  }
}

describe("getRequest", () => {
  it("returns a captured request", async () => {
    const request = createRequest()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          endpointId,
          request,
        })
      )
    )

    await expect(
      getRequest("https://hooks.example.com", endpointId, requestId, signal())
    ).resolves.toEqual(request)
  })

  it("returns null when the request is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            ok: false,
            error: "Request not found.",
          },
          { status: 404 }
        )
      )
    )

    await expect(
      getRequest("https://hooks.example.com", endpointId, requestId, signal())
    ).resolves.toBeNull()
  })

  it("throws a specific error when the endpoint is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            ok: false,
            error: "Endpoint not found.",
          },
          { status: 404 }
        )
      )
    )

    await expect(
      getRequest("https://hooks.example.com", endpointId, requestId, signal())
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "Endpoint not found.",
    } satisfies Partial<ApiError>)
  })
})

describe("replayRequest", () => {
  it("posts to the server replay route without a request body", async () => {
    const replayedRequest = {
      ...createRequest(),
      id: "33333333-3333-4333-8333-333333333333",
    }
    const replayResult = {
      endpointId,
      originalRequestId: requestId,
      request: replayedRequest,
    }
    const fetcher = vi.fn(async () => Response.json(replayResult))
    vi.stubGlobal("fetch", fetcher)

    await expect(
      replayRequest(
        "https://hooks.example.com",
        endpointId,
        requestId,
        signal()
      )
    ).resolves.toEqual(replayResult)

    expect(fetcher).toHaveBeenCalledWith(
      new URL(
        `/api/endpoints/${endpointId}/requests/${requestId}/replay`,
        "https://hooks.example.com"
      ),
      {
        method: "POST",
        signal: expect.any(AbortSignal),
      }
    )
  })
})

function signal() {
  return new AbortController().signal
}
