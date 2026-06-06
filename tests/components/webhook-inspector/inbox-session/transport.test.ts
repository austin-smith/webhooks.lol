import { describe, expect, it, vi } from "vitest"

import { createFetchInboxTransport } from "@/components/webhook-inspector/inbox-session/transport"
import { DEFAULT_INBOX_RESPONSE_CONFIG } from "@/lib/webhooks/inbox-response"
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
    const customResponse = {
      mode: "custom" as const,
      status: 201,
      contentType: "application/json",
      body: '{"ok":true}',
    }
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(createResponse({ token: "new-inbox" }))
      .mockResolvedValueOnce(createResponse({ requests: [createRequest()] }))
      .mockResolvedValueOnce(createResponse({ requests: [] }))
      .mockResolvedValueOnce(
        createResponse({
          token: "inbox",
          response: DEFAULT_INBOX_RESPONSE_CONFIG,
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          token: "inbox",
          response: customResponse,
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          token: "inbox",
          response: DEFAULT_INBOX_RESPONSE_CONFIG,
        })
      )
    const transport = createFetchInboxTransport(fetcher)
    const override = {
      status: 201,
      contentType: "application/json",
      body: '{"ok":true}',
    }

    await expect(transport.createInbox()).resolves.toBe("new-inbox")
    await expect(transport.loadRequests("inbox")).resolves.toEqual([
      createRequest(),
    ])
    await expect(transport.clearInbox("inbox")).resolves.toBeUndefined()
    await expect(transport.loadInboxResponseConfig("inbox")).resolves.toEqual(
      DEFAULT_INBOX_RESPONSE_CONFIG
    )
    await expect(
      transport.saveInboxResponseOverride("inbox", override)
    ).resolves.toEqual(customResponse)
    await expect(
      transport.clearInboxResponseOverride("inbox")
    ).resolves.toEqual(DEFAULT_INBOX_RESPONSE_CONFIG)

    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/inboxes", {
      method: "POST",
    })
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/inboxes/inbox/requests", {
      cache: "no-store",
    })
    expect(fetcher).toHaveBeenNthCalledWith(3, "/api/inboxes/inbox/requests", {
      method: "DELETE",
    })
    expect(fetcher).toHaveBeenNthCalledWith(4, "/api/inboxes/inbox/response", {
      cache: "no-store",
    })
    expect(fetcher).toHaveBeenNthCalledWith(5, "/api/inboxes/inbox/response", {
      body: JSON.stringify(override),
      headers: {
        "content-type": "application/json",
      },
      method: "PUT",
    })
    expect(fetcher).toHaveBeenNthCalledWith(6, "/api/inboxes/inbox/response", {
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
    await expect(transport.loadInboxResponseConfig("inbox")).rejects.toThrow(
      "Could not load response override."
    )
    await expect(
      transport.saveInboxResponseOverride("inbox", {
        status: 200,
        contentType: "text/plain",
        body: "",
      })
    ).rejects.toThrow("Could not save response override.")
    await expect(transport.clearInboxResponseOverride("inbox")).rejects.toThrow(
      "Could not reset response override."
    )
  })
})
