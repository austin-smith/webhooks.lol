import { describe, expect, it, vi } from "vitest"

import {
  createBrowserEndpointEventStream,
  readCapturedRequestEvent,
  readEndpointIdEvent,
} from "@/components/webhook-inspector/endpoint-session/event-stream"
import type { CapturedRequest } from "@/lib/webhooks/types"

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

function createRequest(endpointId: string): CapturedRequest {
  return {
    id: "captured-1",
    endpointId,
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

describe("endpoint event stream", () => {
  it("reads webhook endpoint ID and captured request message events", () => {
    expect(
      readEndpointIdEvent(
        new MessageEvent("ready", { data: '{"endpointId":"endpoint"}' })
      )
    ).toBe("endpoint")

    expect(
      readCapturedRequestEvent(
        new MessageEvent("request", {
          data: JSON.stringify(createRequest("endpoint")),
        })
      )
    ).toEqual(createRequest("endpoint"))

    expect(
      readCapturedRequestEvent(
        new MessageEvent("request", {
          data: JSON.stringify({ endpointId: "endpoint" }),
        })
      )
    ).toBeNull()
  })

  it("filters stream events to the subscribed endpoint", () => {
    const sources: FakeEventSource[] = []
    const stream = createBrowserEndpointEventStream((url) => {
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

    const unsubscribe = stream.subscribe("endpoint", handlers)
    const source = sources[0]

    expect(source.url).toBe("/api/endpoints/endpoint/events")

    source.emit("ready", { endpointId: "other" })
    source.emit("ready", { endpointId: "endpoint" })
    source.emit("request", createRequest("other"))
    source.emit("request", createRequest("endpoint"))
    source.emit("clear", { endpointId: "other" })
    source.emit("clear", { endpointId: "endpoint" })
    source.fail()

    expect(handlers.onReady).toHaveBeenCalledTimes(1)
    expect(handlers.onRequest).toHaveBeenCalledWith(createRequest("endpoint"))
    expect(handlers.onClear).toHaveBeenCalledTimes(1)
    expect(handlers.onError).toHaveBeenCalledTimes(1)

    unsubscribe()

    expect(source.wasClosed).toBe(true)
  })
})
