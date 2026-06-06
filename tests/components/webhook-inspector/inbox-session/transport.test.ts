import { describe, expect, it, vi } from "vitest"

import { createFetchInboxTransport } from "@/components/webhook-inspector/inbox-session/transport"
import type { CapturedRequest } from "@/lib/webhooks/types"

function createResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  })
}

function createRequest(): CapturedRequest {
  return {
    id: "captured-1",
    token: "inbox",
    method: "POST",
    url: "/orders",
    path: "/orders",
    query: {},
    headers: {},
    bodyText: "",
    bodyBase64: "",
    bodySize: 0,
    contentType: null,
    receivedAt: "2026-06-05T00:00:00.000Z",
    ip: null,
  }
}

describe("inbox transport", () => {
  it("creates, loads, and clears through the fetch adapter", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(createResponse({ token: "new-inbox" }))
      .mockResolvedValueOnce(createResponse({ requests: [createRequest()] }))
      .mockResolvedValueOnce(createResponse({ requests: [] }))
    const transport = createFetchInboxTransport(fetcher)

    await expect(transport.createInbox()).resolves.toBe("new-inbox")
    await expect(transport.loadRequests("inbox")).resolves.toEqual([
      createRequest(),
    ])
    await expect(transport.clearInbox("inbox")).resolves.toBeUndefined()

    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/inboxes", {
      method: "POST",
    })
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/inboxes/inbox/requests", {
      cache: "no-store",
    })
    expect(fetcher).toHaveBeenNthCalledWith(3, "/api/inboxes/inbox/requests", {
      method: "DELETE",
    })
  })

  it("maps failed responses to stable errors", async () => {
    const transport = createFetchInboxTransport(
      vi.fn().mockResolvedValue(createResponse({}, { status: 500 }))
    )

    await expect(transport.createInbox()).rejects.toThrow(
      "Could not create inbox."
    )
    await expect(transport.loadRequests("inbox")).rejects.toThrow(
      "Could not load requests."
    )
    await expect(transport.clearInbox("inbox")).rejects.toThrow(
      "Could not clear inbox."
    )
  })
})
