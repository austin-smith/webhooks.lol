import { describe, expect, it, vi } from "vitest"

import {
  openEndpointEventStream,
  publishEndpointCleared,
  publishRequest,
} from "@/lib/webhooks/endpoint-event-stream"
import type { CapturedRequest } from "@/lib/webhooks/types"

const decoder = new TextDecoder()

function createRequest(endpointId: string, id: string): CapturedRequest {
  return {
    id,
    endpointId,
    method: "POST",
    url: "/live/check",
    path: "/live/check",
    query: {},
    headers: {},
    bodyText: "live smoke",
    bodyBase64: "bGl2ZSBzbW9rZQ==",
    bodySize: 10,
    contentType: "text/plain",
    receivedAt: "2026-06-05T00:00:00.000Z",
    ip: "::1",
  }
}

async function readEvent(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const result = await reader.read()

  if (result.done) {
    throw new Error("Expected stream event.")
  }

  return decoder.decode(result.value)
}

describe("openEndpointEventStream", () => {
  it("sends ready and matching request events", async () => {
    const controller = new AbortController()
    const stream = openEndpointEventStream({
      signal: controller.signal,
      endpointId: "endpoint-id",
    })
    const reader = stream.getReader()

    try {
      const readyEvent = await readEvent(reader)

      expect(readyEvent).toContain("event: ready\n")
      expect(readyEvent).toContain('"endpointId":"endpoint-id"')
      expect(readyEvent).toContain('"readyAt":')

      publishRequest(createRequest("other-endpoint-id", "ignored"))
      publishRequest(createRequest("endpoint-id", "captured-1"))

      const event = await readEvent(reader)

      expect(event).toContain("event: request\n")
      expect(event).toContain('"id":"captured-1"')
      expect(event).toContain('"endpointId":"endpoint-id"')
      expect(event).not.toContain("ignored")
    } finally {
      controller.abort()
      reader.releaseLock()
    }
  })

  it("sends clear events for the matching endpoint", async () => {
    const controller = new AbortController()
    const stream = openEndpointEventStream({
      signal: controller.signal,
      endpointId: "clear-endpoint-id",
    })
    const reader = stream.getReader()

    try {
      await readEvent(reader)

      publishEndpointCleared("other-endpoint-id")
      publishEndpointCleared("clear-endpoint-id")

      await expect(readEvent(reader)).resolves.toBe(
        'event: clear\ndata: {"endpointId":"clear-endpoint-id"}\n\n'
      )
    } finally {
      controller.abort()
      reader.releaseLock()
    }
  })

  it("releases connection leases when streams close", async () => {
    const controller = new AbortController()
    const lease = {
      release: vi.fn(async () => undefined),
      renew: vi.fn(async () => undefined),
    }
    const stream = openEndpointEventStream({
      endpointId: "leased-endpoint-id",
      lease,
      signal: controller.signal,
    })
    const reader = stream.getReader()

    try {
      await readEvent(reader)
      controller.abort()
      await Promise.resolve()

      expect(lease.release).toHaveBeenCalledTimes(1)
    } finally {
      reader.releaseLock()
    }
  })
})
