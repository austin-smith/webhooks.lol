import { afterEach, describe, expect, it, vi } from "vitest"

import { streamEndpointEvents } from "../src/core/event-stream.js"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("streamEndpointEvents", () => {
  it("yields ready events with the server ready timestamp", async () => {
    const readyAt = "2026-06-13T12:00:00.000Z"
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `event: ready\ndata: {"endpointId":"endpoint-id","readyAt":"${readyAt}"}\n\n`
          )
        )
        controller.close()
      },
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body, { status: 200 }))
    )

    const controller = new AbortController()
    const stream = streamEndpointEvents({
      signal: controller.signal,
      url: "https://hooks.example.com/events",
    })

    await expect(stream.next()).resolves.toEqual({
      done: false,
      value: { type: "open" },
    })
    await expect(stream.next()).resolves.toEqual({
      done: false,
      value: { endpointId: "endpoint-id", readyAt, type: "ready" },
    })

    controller.abort()
  })
})
