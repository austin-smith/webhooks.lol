import type { CapturedRequest } from "@/lib/webhooks/types"

export type EndpointEventStream = {
  subscribe: (endpointId: string, handlers: EndpointEventHandlers) => () => void
}

export type EndpointEventHandlers = {
  onClear: () => void
  onError: () => void
  onReady: () => void
  onRequest: (request: CapturedRequest) => void
}

type EventSourceFactory = (url: string) => EventSource

export function createBrowserEndpointEventStream(
  createSource: EventSourceFactory = (url) => new EventSource(url)
): EndpointEventStream {
  return {
    subscribe(endpointId, handlers) {
      const events = createSource(`/api/endpoints/${endpointId}/events`)

      const onReady = (event: Event) => {
        if (readEndpointIdEvent(event) === endpointId) {
          handlers.onReady()
        }
      }

      const onRequest = (event: Event) => {
        const request = readCapturedRequestEvent(event)

        if (request?.endpointId === endpointId) {
          handlers.onRequest(request)
        }
      }

      const onClear = (event: Event) => {
        if (readEndpointIdEvent(event) === endpointId) {
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
      typeof data.endpointId !== "string" ||
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

export function readEndpointIdEvent(event: Event) {
  if (!(event instanceof MessageEvent)) {
    return null
  }

  try {
    const data = JSON.parse(event.data) as { endpointId?: unknown }

    return typeof data.endpointId === "string" ? data.endpointId : null
  } catch {
    return null
  }
}
