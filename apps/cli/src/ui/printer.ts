import { styleText } from "node:util"

import type { DeliveryResult } from "../core/deliver.js"
import type { CapturedRequest } from "../core/types.js"

type Color = Parameters<typeof styleText>[0]

export interface Printer {
  banner(lines: string[]): void
  info(message: string): void
  warn(message: string): void
  error(message: string): void
  capture(request: CapturedRequest): void
  delivery(request: CapturedRequest, result: DeliveryResult): void
  json(value: unknown): void
}

export function createPrinter({
  color,
  out = process.stdout,
  err = process.stderr,
}: {
  color: boolean
  out?: NodeJS.WritableStream
  err?: NodeJS.WritableStream
}): Printer {
  const paint = (style: Color, text: string) =>
    color ? styleText(style, text) : text

  return {
    banner(lines) {
      for (const line of lines) {
        out.write(`${line}\n`)
      }
    },
    info(message) {
      err.write(`${paint("dim", "›")} ${message}\n`)
    },
    warn(message) {
      err.write(`${paint("yellow", "⚠")} ${message}\n`)
    },
    error(message) {
      err.write(`${paint("red", "✖")} ${message}\n`)
    },
    capture(request) {
      out.write(`${formatCaptureLine(request, paint)}\n`)
    },
    delivery(request, result) {
      out.write(`${formatDeliveryLine(request, result, paint)}\n`)
    },
    json(value) {
      out.write(`${JSON.stringify(value)}\n`)
    },
  }
}

function formatCaptureLine(
  request: CapturedRequest,
  paint: (style: Color, text: string) => string
): string {
  const parts = [
    paint("dim", formatTime(request.receivedAt)),
    paint("cyan", request.method.padEnd(6)),
    request.path,
  ]

  const summary = summarize(request)
  if (summary) {
    parts.push(paint("dim", summary))
  }

  return parts.join("  ")
}

function formatDeliveryLine(
  request: CapturedRequest,
  result: DeliveryResult,
  paint: (style: Color, text: string) => string
): string {
  const duration = paint("dim", `${Math.round(result.durationMs)}ms`)
  const status =
    result.outcome === "responded" && result.status !== undefined
      ? paint(statusColor(result.status), String(result.status))
      : paint("red", `✖ ${result.error?.message ?? "delivery failed"}`)

  const parts = [
    paint("dim", formatTime(request.receivedAt)),
    paint("cyan", request.method.padEnd(6)),
    request.path.padEnd(20),
    "→",
    status,
    duration,
  ]

  const summary = summarize(request)
  if (summary) {
    parts.push(paint("dim", summary))
  }

  return parts.join("  ")
}

// Best-effort one-word summary from a JSON body's common event-type fields.
function summarize(request: CapturedRequest): string | null {
  if (!request.bodyText) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(request.bodyText)
    if (typeof parsed !== "object" || parsed === null) {
      return null
    }

    const candidate = parsed as Record<string, unknown>
    for (const key of ["type", "event", "event_type", "eventType"]) {
      const value = candidate[key]
      if (typeof value === "string") {
        return value
      }
    }
  } catch {
    return null
  }

  return null
}

function statusColor(status: number): Color {
  if (status >= 500) {
    return "red"
  }
  if (status >= 400) {
    return "yellow"
  }
  if (status >= 200 && status < 300) {
    return "green"
  }
  return "white"
}

function formatTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) {
    return "--:--:--"
  }

  return date.toTimeString().slice(0, 8)
}
