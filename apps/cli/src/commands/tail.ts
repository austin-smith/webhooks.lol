import { CliError } from "../cli-error.js"
import { eventStreamUrl, receiveUrl } from "../core/api-client.js"
import { streamEndpointEvents } from "../core/event-stream.js"
import { matchesFilter, type RequestFilter } from "../core/filter.js"
import type { CapturedRequest } from "../core/types.js"
import type { Printer } from "../ui/printer.js"

export interface TailOptions {
  baseUrl: string
  endpointId: string
  filter: RequestFilter
  json: boolean
  signal: AbortSignal
  printer: Printer
}

export async function runTail(options: TailOptions): Promise<void> {
  const { baseUrl, endpointId, filter, json, signal, printer } = options

  if (!json) {
    printer.banner([
      `Endpoint  ${receiveUrl(baseUrl, endpointId)}`,
      `Tailing   live requests (Ctrl-C to stop)`,
      "",
    ])
  }

  for await (const message of streamEndpointEvents({
    url: eventStreamUrl(baseUrl, endpointId),
    signal,
  })) {
    switch (message.type) {
      case "ready":
        printer.info("connected")
        break
      case "request":
        emit(message.request, { filter, json, printer })
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
}

function emit(
  request: CapturedRequest,
  {
    filter,
    json,
    printer,
  }: { filter: RequestFilter; json: boolean; printer: Printer }
): void {
  if (!matchesFilter(request, filter)) {
    return
  }

  if (json) {
    printer.json(request)
  } else {
    printer.capture(request)
  }
}
