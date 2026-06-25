import { describe, expect, it, vi } from "vitest"

import {
  createBrowserEndpointEventStream,
  readCapturedRequestEvent,
  readEndpointIdEvent,
} from "@/components/webhook-inspector/endpoint-session/event-stream"
import type { CapturedRequest } from "@webhooks-lol/webhooks-core/types"

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"
const OTHER_ENDPOINT_ID = "22222222-2222-4222-8222-222222222222"

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
        new MessageEvent("ready", {
          data: JSON.stringify({ endpointId: ENDPOINT_ID }),
        })
      )
    ).toBe(ENDPOINT_ID)

    expect(
      readCapturedRequestEvent(
        new MessageEvent("request", {
          data: JSON.stringify(createRequest(ENDPOINT_ID)),
        })
      )
    ).toEqual(createRequest(ENDPOINT_ID))

    expect(
      readCapturedRequestEvent(
        new MessageEvent("request", {
          data: JSON.stringify({ endpointId: ENDPOINT_ID }),
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
      onDeleted: vi.fn(),
      onError: vi.fn(),
      onReady: vi.fn(),
      onRequest: vi.fn(),
    }

    const unsubscribe = stream.subscribe(ENDPOINT_ID, handlers)
    const source = sources[0]

    expect(source.url).toBe(`/api/endpoints/${ENDPOINT_ID}/events`)

    source.emit("ready", { endpointId: OTHER_ENDPOINT_ID })
    source.emit("ready", { endpointId: ENDPOINT_ID })
    source.emit("request", createRequest(OTHER_ENDPOINT_ID))
    source.emit("request", createRequest(ENDPOINT_ID))
    source.emit("clear", { endpointId: OTHER_ENDPOINT_ID })
    source.emit("clear", { endpointId: ENDPOINT_ID })
    source.emit("deleted", { endpointId: OTHER_ENDPOINT_ID })
    source.emit("deleted", { endpointId: ENDPOINT_ID })
    source.fail()

    expect(handlers.onReady).toHaveBeenCalledTimes(1)
    expect(handlers.onRequest).toHaveBeenCalledWith(createRequest(ENDPOINT_ID))
    expect(handlers.onClear).toHaveBeenCalledTimes(1)
    expect(handlers.onDeleted).toHaveBeenCalledTimes(1)
    expect(handlers.onError).toHaveBeenCalledTimes(1)

    unsubscribe()

    expect(source.wasClosed).toBe(true)
  })
})
