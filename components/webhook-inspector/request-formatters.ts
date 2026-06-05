import type { CapturedRequest } from "@/lib/webhook-types"

import type { ConnectionState } from "./types"

export type MethodBadgeVariant = "default" | "secondary" | "outline"

export function formatRequestDetailPath(request: CapturedRequest) {
  return request.path === "/" ? null : request.path
}

export function formatRequestBody(request: CapturedRequest) {
  if (!request.bodyText) {
    if (request.bodyBase64) {
      return formatBinaryBody(request)
    }

    return ""
  }

  if (isJsonContentType(request.contentType)) {
    try {
      return JSON.stringify(JSON.parse(request.bodyText), null, 2)
    } catch {
      return request.bodyText
    }
  }

  return request.bodyText
}

export function formatRawRequestBody(request: CapturedRequest) {
  if (request.bodyText) {
    return request.bodyText
  }

  if (request.bodyBase64) {
    return formatBinaryBody(request)
  }

  return ""
}

export function formatRawRequest(request: CapturedRequest) {
  const requestTarget = getRequestTarget(request)
  const startLine = `${request.method} ${requestTarget} HTTP/1.1`
  const headerLines = Object.entries(request.headers)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}: ${value}`)
  const body = formatRawRequestBody(request)

  return [startLine, ...headerLines, "", body].join("\n").trimEnd()
}

function getRequestTarget(request: CapturedRequest) {
  const url = request.url || request.path || "/"
  const internalPrefix = `/api/hook/${request.token}`

  if (url === internalPrefix) {
    return request.path || "/"
  }

  if (url.startsWith(`${internalPrefix}?`)) {
    return `/${url.slice(internalPrefix.length)}`
  }

  if (url.startsWith(`${internalPrefix}/`)) {
    return url.slice(internalPrefix.length)
  }

  return url
}

export function getMethodBadgeVariant(method: string): MethodBadgeVariant {
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    return "default"
  }

  if (method === "GET") {
    return "secondary"
  }

  return "outline"
}

export function formatConnectionState(state: ConnectionState) {
  if (state === "live") {
    return "LIVE"
  }

  if (state === "connecting") {
    return "SYNC"
  }

  return "RETRY"
}

export function formatRequestTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value))
}

export function formatRequestDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value))
}

export function formatShortToken(token: string | null) {
  if (!token) {
    return "No inbox"
  }

  return token.slice(0, 8)
}

function formatBinaryBody(request: CapturedRequest) {
  return `Binary body\n\nBase64:\n${request.bodyBase64}`
}

function isJsonContentType(contentType: string | null) {
  return contentType?.toLowerCase().includes("json") ?? false
}
