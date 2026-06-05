import "server-only"

import { EventEmitter } from "node:events"

import type { CapturedRequest } from "@/lib/webhook-types"

const REQUEST_EVENT = "request"
const CLEAR_EVENT = "clear"
const HEARTBEAT_INTERVAL_MS = 25_000

type InboxClearedEvent = {
  token: string
}

const globalForEvents = globalThis as typeof globalThis & {
  __webhooksLolEvents?: EventEmitter
}

function getWebhookEvents() {
  if (!globalForEvents.__webhooksLolEvents) {
    const events = new EventEmitter()
    events.setMaxListeners(0)
    globalForEvents.__webhooksLolEvents = events
  }

  return globalForEvents.__webhooksLolEvents
}

export function publishRequest(request: CapturedRequest) {
  getWebhookEvents().emit(REQUEST_EVENT, request)
}

export function publishInboxCleared(token: string) {
  getWebhookEvents().emit(CLEAR_EVENT, { token })
}

export function openInboxEventStream({
  signal,
  token,
}: {
  signal: AbortSignal
  token: string
}) {
  const encoder = new TextEncoder()
  let cleanupStream: (() => void) | null = null

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const events = getWebhookEvents()
      let isClosed = false

      const enqueue = (value: string) => {
        if (isClosed) {
          return
        }

        try {
          controller.enqueue(encoder.encode(value))
        } catch {
          cleanup()
        }
      }

      const send = (event: string, data: unknown) => {
        if (isClosed) {
          return
        }

        enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      }

      const onRequest = (capturedRequest: CapturedRequest) => {
        if (capturedRequest.token === token) {
          send(REQUEST_EVENT, capturedRequest)
        }
      }

      const onClear = (event: InboxClearedEvent) => {
        if (event.token === token) {
          send(CLEAR_EVENT, event)
        }
      }

      const heartbeat = setInterval(() => {
        if (isClosed) {
          return
        }

        enqueue(": keepalive\n\n")
      }, HEARTBEAT_INTERVAL_MS)

      const cleanup = () => {
        if (isClosed) {
          return
        }

        isClosed = true
        clearInterval(heartbeat)
        events.off(REQUEST_EVENT, onRequest)
        events.off(CLEAR_EVENT, onClear)
        signal.removeEventListener("abort", cleanup)

        try {
          controller.close()
        } catch {
          // The browser can close the stream before the abort event settles.
        }
      }

      cleanupStream = cleanup

      events.on(REQUEST_EVENT, onRequest)
      events.on(CLEAR_EVENT, onClear)
      send("ready", { token })

      signal.addEventListener("abort", cleanup, { once: true })
    },
    cancel() {
      cleanupStream?.()
    },
  })
}
