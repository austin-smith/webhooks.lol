import { CliError } from "../cli-error.js"
import { getRequest, replayRequest } from "../core/api-client.js"
import { fetchAllRequests } from "../core/backfill.js"
import { deliverRequest } from "../core/deliver.js"
import {
  filterIsActive,
  matchesFilter,
  type RequestFilter,
} from "../core/filter.js"
import type { PathMode } from "../core/request-shape.js"
import type { CapturedRequest } from "../core/types.js"
import type { Printer } from "../ui/printer.js"

const REPLAY_MAX_PAGES = 10

export interface ReplayOptions {
  baseUrl: string
  endpointId: string
  requestId: string | null
  filter: RequestFilter
  localTarget: string | null
  pathMode: PathMode
  pathModeWasProvided: boolean
  timeoutMs: number
  timeoutWasProvided: boolean
  json: boolean
  signal: AbortSignal
  printer: Printer
}

export async function runReplay(options: ReplayOptions): Promise<void> {
  if (!options.localTarget && options.pathModeWasProvided) {
    throw new CliError(
      "Server replay uses the original captured request path. --path only applies to local replay with --to."
    )
  }

  if (!options.localTarget && options.timeoutWasProvided) {
    throw new CliError(
      "Server replay uses the webhooks.lol capture path. --timeout only applies to local replay with --to."
    )
  }

  const requests = await collectRequests(options)

  if (requests.length === 0) {
    options.printer.warn("no matching requests to replay")
    return
  }

  for (const request of requests) {
    if (options.signal.aborted) {
      return
    }

    if (!options.localTarget) {
      await replayViaServer({
        options,
        request,
      })
      continue
    }

    const result = await deliverRequest({
      request,
      target: options.localTarget,
      pathMode: options.pathMode,
      timeoutMs: options.timeoutMs,
      signal: options.signal,
    })

    if (options.json) {
      options.printer.json({ request, delivery: result })
    } else {
      options.printer.delivery(request, result)
    }
  }
}

async function replayViaServer({
  options,
  request,
}: {
  options: ReplayOptions
  request: CapturedRequest
}) {
  const result = await replayRequest(
    options.baseUrl,
    options.endpointId,
    request.id,
    options.signal
  )

  if (options.json) {
    options.printer.json({ request, replay: result })
    return
  }

  options.printer.info(
    `${request.method} ${request.path} replayed as ${result.request.id}`
  )
}

async function collectRequests(
  options: ReplayOptions
): Promise<CapturedRequest[]> {
  const { baseUrl, endpointId, requestId, filter, signal, printer } = options

  if (requestId) {
    const request = await getRequest(baseUrl, endpointId, requestId, signal)
    if (!request) {
      throw new CliError(
        `Request ${requestId} was not found on endpoint ${endpointId}.`
      )
    }
    return [request]
  }

  if (!filterIsActive(filter)) {
    throw new CliError(
      "Specify --request <id>, or --method/--grep, to choose which stored requests to replay."
    )
  }

  const { requests, truncated } = await fetchAllRequests({
    baseUrl,
    endpointId,
    maxPages: REPLAY_MAX_PAGES,
    signal,
  })

  if (truncated) {
    printer.warn(
      `searched the most recent ${REPLAY_MAX_PAGES} pages; older requests were not considered`
    )
  }

  // Stored newest-first; replay oldest-first to match capture order.
  return requests.filter((request) => matchesFilter(request, filter)).reverse()
}
