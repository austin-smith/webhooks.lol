import { CliError } from "../cli-error.js"
import {
  createEndpoint,
  eventStreamUrl,
  receiveUrl,
} from "../core/api-client.js"
import { fetchRequestsSince } from "../core/backfill.js"
import { BoundedSet } from "../core/bounded-set.js"
import { deliverWithRetry } from "../core/deliver.js"
import { streamEndpointEvents } from "../core/event-stream.js"
import { matchesFilter, type RequestFilter } from "../core/filter.js"
import type { PathMode } from "../core/request-shape.js"
import { TaskPool } from "../core/task-pool.js"
import type { CapturedRequest } from "../core/types.js"
import type { Printer } from "../ui/printer.js"

const DELIVERED_HISTORY = 2000
const CONCURRENCY = 10
const BACKFILL_MAX_PAGES = 10

export interface ForwardOptions {
  baseUrl: string
  endpointId: string | null
  target: string
  pathMode: PathMode
  filter: RequestFilter
  timeoutMs: number
  maxRetries: number
  catchup: boolean
  replayExisting: boolean
  json: boolean
  signal: AbortSignal
  printer: Printer
}

export async function runForward(options: ForwardOptions): Promise<void> {
  const { baseUrl, target, pathMode, filter, signal, printer } = options

  const endpointId =
    options.endpointId ?? (await createNewEndpoint(baseUrl, signal, printer))

  if (!options.json) {
    printer.banner([
      `Endpoint  ${receiveUrl(baseUrl, endpointId)}`,
      `Forward → ${target}`,
      `Mapping   ${pathMode === "preserve" ? "preserve subpath" : "strip subpath"}`,
      "",
    ])
  }

  const delivered = new BoundedSet<string>(DELIVERED_HISTORY)
  const pool = new TaskPool(CONCURRENCY)
  let lastSeen: string | null = null
  let connectedBefore = false

  const handle = async (request: CapturedRequest): Promise<void> => {
    if (delivered.has(request.id) || !matchesFilter(request, filter)) {
      return
    }

    delivered.add(request.id)
    if (lastSeen === null || request.receivedAt > lastSeen) {
      lastSeen = request.receivedAt
    }

    const result = await deliverWithRetry({
      request,
      target,
      pathMode,
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
      signal,
      onRetry: (attempt, delayMs) => {
        printer.warn(
          `local target unreachable, retrying ${request.method} ${request.path} in ${Math.round(delayMs / 1000)}s (attempt ${attempt})`
        )
      },
    })

    if (options.json) {
      printer.json({ request, delivery: result })
    } else {
      printer.delivery(request, result)
    }
  }

  for await (const message of streamEndpointEvents({
    url: eventStreamUrl(baseUrl, endpointId),
    signal,
  })) {
    switch (message.type) {
      case "ready": {
        const shouldBackfill =
          options.catchup && (connectedBefore || options.replayExisting)
        if (shouldBackfill) {
          await backfill({
            baseUrl,
            endpointId,
            since: options.replayExisting && !connectedBefore ? null : lastSeen,
            delivered,
            pool,
            handle,
            signal,
            printer,
          })
        }
        connectedBefore = true
        printer.info("listening")
        break
      }
      case "request":
        void pool.run(() => handle(message.request))
        break
      case "clear":
        printer.info("requests cleared")
        break
      case "reconnecting":
        printer.warn(
          `disconnected, reconnecting in ${Math.round(message.delayMs / 1000)}s (attempt ${message.attempt})`
        )
        break
      case "fatal":
        throw new CliError(message.message)
      case "open":
        break
    }
  }

  await pool.drain()
}

async function createNewEndpoint(
  baseUrl: string,
  signal: AbortSignal,
  printer: Printer
): Promise<string> {
  const created = await createEndpoint(baseUrl, signal)
  if (created.name) {
    printer.info(`created endpoint "${created.name}"`)
  }
  return created.endpointId
}

async function backfill({
  baseUrl,
  endpointId,
  since,
  delivered,
  pool,
  handle,
  signal,
  printer,
}: {
  baseUrl: string
  endpointId: string
  since: string | null
  delivered: BoundedSet<string>
  pool: TaskPool
  handle: (request: CapturedRequest) => Promise<void>
  signal: AbortSignal
  printer: Printer
}): Promise<void> {
  let result
  try {
    result = await fetchRequestsSince({
      baseUrl,
      endpointId,
      since,
      delivered,
      maxPages: BACKFILL_MAX_PAGES,
      signal,
    })
  } catch (error) {
    if (signal.aborted) {
      return
    }
    printer.warn(
      `catch-up failed: ${error instanceof Error ? error.message : String(error)}`
    )
    return
  }

  if (result.requests.length > 0) {
    printer.info(`delivering ${result.requests.length} missed request(s)`)
  }

  if (result.truncated) {
    printer.warn(
      `catch-up stopped at ${BACKFILL_MAX_PAGES} pages; older missed requests were not replayed`
    )
  }

  for (const request of result.requests) {
    void pool.run(() => handle(request))
  }
}
