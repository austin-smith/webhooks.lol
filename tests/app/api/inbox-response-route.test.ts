import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_INBOX_RESPONSE_CONFIG,
  MAX_RESPONSE_OVERRIDE_REQUEST_BYTES,
} from "@/lib/webhooks/inbox-response"

const {
  clearInboxResponseOverride,
  getInboxResponseConfig,
  setInboxResponseOverride,
} = vi.hoisted(() => ({
  clearInboxResponseOverride: vi.fn(),
  getInboxResponseConfig: vi.fn(),
  setInboxResponseOverride: vi.fn(),
}))

vi.mock("@/lib/webhooks/repository", () => ({
  clearInboxResponseOverride,
  getInboxResponseConfig,
  setInboxResponseOverride,
}))

import { DELETE, GET, PUT } from "@/app/api/inboxes/[token]/response/route"

function createContext(token = "inbox-token") {
  return {
    params: Promise.resolve({ token }),
  } as RouteContext<"/api/inboxes/[token]/response">
}

describe("inbox response route", () => {
  beforeEach(() => {
    clearInboxResponseOverride.mockReset()
    getInboxResponseConfig.mockReset()
    setInboxResponseOverride.mockReset()
  })

  it("returns the current response config", async () => {
    getInboxResponseConfig.mockResolvedValueOnce(DEFAULT_INBOX_RESPONSE_CONFIG)

    const response = await GET(
      new Request("https://hooks.example.com/api/inboxes/inbox-token/response"),
      createContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      token: "inbox-token",
      response: DEFAULT_INBOX_RESPONSE_CONFIG,
    })
    expect(getInboxResponseConfig).toHaveBeenCalledWith("inbox-token")
  })

  it("validates and stores a custom response override", async () => {
    const override = {
      status: 201,
      contentType: "application/json",
      body: '{"ok":true}',
    }
    setInboxResponseOverride.mockResolvedValueOnce({
      mode: "custom",
      ...override,
    })

    const response = await PUT(
      new Request(
        "https://hooks.example.com/api/inboxes/inbox-token/response",
        {
          method: "PUT",
          body: JSON.stringify(override),
        }
      ),
      createContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      token: "inbox-token",
      response: {
        mode: "custom",
        ...override,
      },
    })
    expect(setInboxResponseOverride).toHaveBeenCalledWith({
      token: "inbox-token",
      override,
    })
  })

  it("rejects invalid override input", async () => {
    const response = await PUT(
      new Request(
        "https://hooks.example.com/api/inboxes/inbox-token/response",
        {
          method: "PUT",
          body: JSON.stringify({
            status: 700,
            contentType: "text/plain",
            body: "",
          }),
        }
      ),
      createContext()
    )

    expect(response.status).toBe(400)
    expect(setInboxResponseOverride).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("Status must be"),
      })
    )
  })

  it("rejects malformed JSON", async () => {
    const response = await PUT(
      new Request(
        "https://hooks.example.com/api/inboxes/inbox-token/response",
        {
          method: "PUT",
          body: "{",
        }
      ),
      createContext()
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Request body must be valid JSON.",
    })
  })

  it("rejects oversized override requests before storing", async () => {
    const response = await PUT(
      new Request(
        "https://hooks.example.com/api/inboxes/inbox-token/response",
        {
          method: "PUT",
          body: "x".repeat(MAX_RESPONSE_OVERRIDE_REQUEST_BYTES + 1),
        }
      ),
      createContext()
    )

    expect(response.status).toBe(413)
    expect(setInboxResponseOverride).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Request body too large.",
      maxBodyBytes: MAX_RESPONSE_OVERRIDE_REQUEST_BYTES,
    })
  })

  it("clears a response override", async () => {
    clearInboxResponseOverride.mockResolvedValueOnce(
      DEFAULT_INBOX_RESPONSE_CONFIG
    )

    const response = await DELETE(
      new Request(
        "https://hooks.example.com/api/inboxes/inbox-token/response",
        {
          method: "DELETE",
        }
      ),
      createContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      token: "inbox-token",
      response: DEFAULT_INBOX_RESPONSE_CONFIG,
    })
    expect(clearInboxResponseOverride).toHaveBeenCalledWith("inbox-token")
  })
})
