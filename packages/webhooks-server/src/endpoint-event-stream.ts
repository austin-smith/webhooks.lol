import "server-only"

import { EventEmitter } from "node:events"

import type { EventStreamLease } from "@webhooks-lol/webhooks-server/admission-control"
import type { CapturedRequest } from "@webhooks-lol/webhooks-core/types"

const REQUEST_EVENT = "request"
const CLEAR_EVENT = "clear"
const ACCESS_REVOKED_EVENT = "access-revoked"
const HEARTBEAT_INTERVAL_MS = 25_000

type EndpointEvent = {
  endpointId: string
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

export function publishEndpointCleared(endpointId: string) {
  getWebhookEvents().emit(CLEAR_EVENT, { endpointId })
}

export function publishEndpointAccessRevoked(endpointId: string) {
  getWebhookEvents().emit(ACCESS_REVOKED_EVENT, { endpointId })
}

export function openEndpointEventStream({
  lease,
  signal,
  endpointId,
}: {
  lease?: EventStreamLease
  signal: AbortSignal
  endpointId: string
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
        if (capturedRequest.endpointId === endpointId) {
          send(REQUEST_EVENT, capturedRequest)
        }
      }

      const onClear = (event: EndpointEvent) => {
        if (event.endpointId === endpointId) {
          send(CLEAR_EVENT, event)
        }
      }

      const onAccessRevoked = (event: EndpointEvent) => {
        if (event.endpointId === endpointId) {
          cleanup()
        }
      }

      const heartbeat = setInterval(() => {
        if (isClosed) {
          return
        }

        void lease?.renew().catch(() => {
          // Lease expiry is enforced by Redis; renewal failures should not crash the stream.
        })
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
        events.off(ACCESS_REVOKED_EVENT, onAccessRevoked)
        signal.removeEventListener("abort", cleanup)
        void lease?.release().catch(() => {
          // Expiring leases provide a fallback if explicit cleanup cannot reach Redis.
        })

        try {
          controller.close()
        } catch {
          // The browser can close the stream before the abort event settles.
        }
      }

      cleanupStream = cleanup

      events.on(REQUEST_EVENT, onRequest)
      events.on(CLEAR_EVENT, onClear)
      events.on(ACCESS_REVOKED_EVENT, onAccessRevoked)
      send("ready", { endpointId, readyAt: new Date().toISOString() })

      signal.addEventListener("abort", cleanup, { once: true })
    },
    cancel() {
      cleanupStream?.()
    },
  })
}
