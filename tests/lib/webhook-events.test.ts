import { describe, expect, it } from "vitest"

import {
  openInboxEventStream,
  publishInboxCleared,
  publishRequest,
} from "@/lib/webhooks/events"
import type { CapturedRequest } from "@/lib/webhooks/types"

const decoder = new TextDecoder()

function createRequest(token: string, id: string): CapturedRequest {
  return {
    id,
    token,
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

describe("openInboxEventStream", () => {
  it("sends ready and matching request events", async () => {
    const controller = new AbortController()
    const stream = openInboxEventStream({
      signal: controller.signal,
      token: "inbox-token",
    })
    const reader = stream.getReader()

    try {
      await expect(readEvent(reader)).resolves.toBe(
        'event: ready\ndata: {"token":"inbox-token"}\n\n'
      )

      publishRequest(createRequest("other-token", "ignored"))
      publishRequest(createRequest("inbox-token", "captured-1"))

      const event = await readEvent(reader)

      expect(event).toContain("event: request\n")
      expect(event).toContain('"id":"captured-1"')
      expect(event).toContain('"token":"inbox-token"')
      expect(event).not.toContain("ignored")
    } finally {
      controller.abort()
      reader.releaseLock()
    }
  })

  it("sends clear events for the matching inbox", async () => {
    const controller = new AbortController()
    const stream = openInboxEventStream({
      signal: controller.signal,
      token: "clear-token",
    })
    const reader = stream.getReader()

    try {
      await readEvent(reader)

      publishInboxCleared("other-token")
      publishInboxCleared("clear-token")

      await expect(readEvent(reader)).resolves.toBe(
        'event: clear\ndata: {"token":"clear-token"}\n\n'
      )
    } finally {
      controller.abort()
      reader.releaseLock()
    }
  })
})
