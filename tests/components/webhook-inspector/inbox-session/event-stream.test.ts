import { describe, expect, it, vi } from "vitest"

import {
  createBrowserInboxEventStream,
  readCapturedRequestEvent,
  readTokenEvent,
} from "@/components/webhook-inspector/inbox-session/event-stream"
import type { CapturedRequest } from "@/lib/webhook-types"

class FakeEventSource extends EventTarget {
  onerror: ((event: Event) => void) | null = null
  url: string
  wasClosed = false

  constructor(url: string) {
    super()
    this.url = url
  }

  close() {
    this.wasClosed = true
  }

  emit(type: string, data: unknown) {
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }))
  }

  fail() {
    this.onerror?.(new Event("error"))
  }
}

function createRequest(token: string): CapturedRequest {
  return {
    id: "captured-1",
    token,
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

describe("inbox event stream", () => {
  it("reads token and captured request message events", () => {
    expect(
      readTokenEvent(new MessageEvent("ready", { data: '{"token":"inbox"}' }))
    ).toBe("inbox")

    expect(
      readCapturedRequestEvent(
        new MessageEvent("request", {
          data: JSON.stringify(createRequest("inbox")),
        })
      )
    ).toEqual(createRequest("inbox"))

    expect(
      readCapturedRequestEvent(
        new MessageEvent("request", {
          data: JSON.stringify({ token: "inbox" }),
        })
      )
    ).toBeNull()
  })

  it("filters stream events to the subscribed inbox", () => {
    const sources: FakeEventSource[] = []
    const stream = createBrowserInboxEventStream((url) => {
      const source = new FakeEventSource(url)

      sources.push(source)

      return source as unknown as EventSource
    })
    const handlers = {
      onClear: vi.fn(),
      onError: vi.fn(),
      onReady: vi.fn(),
      onRequest: vi.fn(),
    }

    const unsubscribe = stream.subscribe("inbox", handlers)
    const source = sources[0]

    expect(source.url).toBe("/api/inboxes/inbox/events")

    source.emit("ready", { token: "other" })
    source.emit("ready", { token: "inbox" })
    source.emit("request", createRequest("other"))
    source.emit("request", createRequest("inbox"))
    source.emit("clear", { token: "other" })
    source.emit("clear", { token: "inbox" })
    source.fail()

    expect(handlers.onReady).toHaveBeenCalledTimes(1)
    expect(handlers.onRequest).toHaveBeenCalledWith(createRequest("inbox"))
    expect(handlers.onClear).toHaveBeenCalledTimes(1)
    expect(handlers.onError).toHaveBeenCalledTimes(1)

    unsubscribe()

    expect(source.wasClosed).toBe(true)
  })
})
