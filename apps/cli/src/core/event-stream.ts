import { SseParser, type SseEvent } from "./sse-parser.js"
import { backoffDelay, sleep } from "./timing.js"
import type { CapturedRequest, StreamMessage } from "./types.js"

interface StreamOptions {
  url: string
  signal: AbortSignal
}

// Connects to an endpoint's SSE stream and yields decoded StreamMessages,
// reconnecting with backoff whenever the connection drops. Terminates when the
// signal aborts, or yields a single "fatal" message for a missing endpoint.
export async function* streamEndpointEvents({
  url,
  signal,
}: StreamOptions): AsyncGenerator<StreamMessage> {
  let attempt = 0

  while (!signal.aborted) {
    let response: Response

    try {
      response = await fetch(url, {
        headers: { accept: "text/event-stream" },
        signal,
      })
    } catch (error) {
      if (signal.aborted) {
        return
      }

      attempt += 1
      const delayMs = backoffDelay(attempt)
      yield { type: "reconnecting", attempt, delayMs, error }
      await sleep(delayMs, signal)
      continue
    }

    if (response.status === 404) {
      yield { type: "fatal", status: 404, message: "Endpoint not found." }
      return
    }

    if (!response.ok || !response.body) {
      attempt += 1
      const delayMs = backoffDelay(attempt)
      yield {
        type: "reconnecting",
        attempt,
        delayMs,
        error: new Error(`Unexpected response status ${response.status}.`),
      }
      await sleep(delayMs, signal)
      continue
    }

    attempt = 0
    yield { type: "open" }

    try {
      yield* readEventBody(response.body, signal)
    } catch (error) {
      if (signal.aborted) {
        return
      }

      attempt += 1
      const delayMs = backoffDelay(attempt)
      yield { type: "reconnecting", attempt, delayMs, error }
      await sleep(delayMs, signal)
      continue
    }

    if (signal.aborted) {
      return
    }

    // The stream closed cleanly without an abort; reconnect to resume capture.
    attempt += 1
    const delayMs = backoffDelay(attempt)
    yield {
      type: "reconnecting",
      attempt,
      delayMs,
      error: new Error("Event stream closed."),
    }
    await sleep(delayMs, signal)
  }
}

async function* readEventBody(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal
): AsyncGenerator<StreamMessage> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const parser = new SseParser()

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        return
      }

      for (const event of parser.push(
        decoder.decode(value, { stream: true })
      )) {
        const message = toStreamMessage(event)
        if (message) {
          yield message
        }
      }
    }
  } finally {
    reader.releaseLock()
    if (!signal.aborted) {
      await body.cancel().catch(() => {})
    }
  }
}

function toStreamMessage(event: SseEvent): StreamMessage | null {
  switch (event.event) {
    case "ready": {
      const endpointId = readEndpointId(event.data)
      return endpointId ? { type: "ready", endpointId } : null
    }
    case "clear": {
      const endpointId = readEndpointId(event.data)
      return endpointId ? { type: "clear", endpointId } : null
    }
    case "request": {
      const request = parseCapturedRequest(event.data)
      return request ? { type: "request", request } : null
    }
    default:
      return null
  }
}

function readEndpointId(data: string): string | null {
  try {
    const parsed: unknown = JSON.parse(data)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { endpointId?: unknown }).endpointId === "string"
    ) {
      return (parsed as { endpointId: string }).endpointId
    }
  } catch {
    return null
  }

  return null
}

function parseCapturedRequest(data: string): CapturedRequest | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(data)
  } catch {
    return null
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null
  }

  const candidate = parsed as Record<string, unknown>
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.endpointId !== "string" ||
    typeof candidate.method !== "string"
  ) {
    return null
  }

  return parsed as CapturedRequest
}
