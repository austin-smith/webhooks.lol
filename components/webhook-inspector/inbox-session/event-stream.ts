import type { CapturedRequest } from "@/lib/webhook-types"

export type InboxEventStream = {
  subscribe: (token: string, handlers: InboxEventHandlers) => () => void
}

export type InboxEventHandlers = {
  onClear: () => void
  onError: () => void
  onReady: () => void
  onRequest: (request: CapturedRequest) => void
}

type EventSourceFactory = (url: string) => EventSource

export function createBrowserInboxEventStream(
  createSource: EventSourceFactory = (url) => new EventSource(url)
): InboxEventStream {
  return {
    subscribe(token, handlers) {
      const events = createSource(`/api/inboxes/${token}/events`)

      const onReady = (event: Event) => {
        if (readTokenEvent(event) === token) {
          handlers.onReady()
        }
      }

      const onRequest = (event: Event) => {
        const request = readCapturedRequestEvent(event)

        if (request?.token === token) {
          handlers.onRequest(request)
        }
      }

      const onClear = (event: Event) => {
        if (readTokenEvent(event) === token) {
          handlers.onClear()
        }
      }

      events.addEventListener("ready", onReady)
      events.addEventListener("request", onRequest)
      events.addEventListener("clear", onClear)
      events.onerror = handlers.onError

      return () => {
        events.removeEventListener("ready", onReady)
        events.removeEventListener("request", onRequest)
        events.removeEventListener("clear", onClear)
        events.close()
      }
    },
  }
}

export function readCapturedRequestEvent(event: Event) {
  if (!(event instanceof MessageEvent)) {
    return null
  }

  try {
    const data = JSON.parse(event.data) as Partial<CapturedRequest>

    if (
      typeof data.id !== "string" ||
      typeof data.token !== "string" ||
      typeof data.method !== "string" ||
      typeof data.receivedAt !== "string"
    ) {
      return null
    }

    return data as CapturedRequest
  } catch {
    return null
  }
}

export function readTokenEvent(event: Event) {
  if (!(event instanceof MessageEvent)) {
    return null
  }

  try {
    const data = JSON.parse(event.data) as { token?: unknown }

    return typeof data.token === "string" ? data.token : null
  } catch {
    return null
  }
}
