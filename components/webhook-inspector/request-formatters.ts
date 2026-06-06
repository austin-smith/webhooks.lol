import type { CapturedRequest } from "@/lib/webhooks/types"

import type { ConnectionState } from "./types"

export type MethodBadgeVariant = "default" | "secondary" | "outline"
export type RequestBodyLanguage =
  | "css"
  | "html"
  | "javascript"
  | "json"
  | "text"
  | "xml"
  | "yaml"

export type FormattedRequestBody = {
  language: RequestBodyLanguage
  value: string
}

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

export function formatRequestBodyDisplay(
  request: CapturedRequest
): FormattedRequestBody {
  const value = formatRequestBody(request)

  return {
    language: value ? getRequestBodyLanguage(request.contentType) : "text",
    value,
  }
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

export function getRequestBodyLanguage(
  contentType: string | null
): RequestBodyLanguage {
  const mimeType = normalizeContentType(contentType)

  if (isJsonMimeType(mimeType)) {
    return "json"
  }

  if (mimeType === "text/html" || mimeType.endsWith("+html")) {
    return "html"
  }

  if (isXmlMimeType(mimeType)) {
    return "xml"
  }

  if (isJavaScriptMimeType(mimeType)) {
    return "javascript"
  }

  if (mimeType === "text/css") {
    return "css"
  }

  if (isYamlMimeType(mimeType)) {
    return "yaml"
  }

  return "text"
}

function formatBinaryBody(request: CapturedRequest) {
  return `Binary body\n\nBase64:\n${request.bodyBase64}`
}

function isJsonContentType(contentType: string | null) {
  return isJsonMimeType(normalizeContentType(contentType))
}

function normalizeContentType(contentType: string | null) {
  return contentType?.split(";")[0]?.trim().toLowerCase() ?? ""
}

function isJsonMimeType(mimeType: string) {
  return mimeType === "application/json" || mimeType.endsWith("+json")
}

function isXmlMimeType(mimeType: string) {
  return (
    mimeType === "application/xml" ||
    mimeType === "text/xml" ||
    mimeType.endsWith("+xml")
  )
}

function isJavaScriptMimeType(mimeType: string) {
  return (
    mimeType === "application/javascript" ||
    mimeType === "application/ecmascript" ||
    mimeType === "application/x-javascript" ||
    mimeType === "text/javascript" ||
    mimeType === "text/ecmascript"
  )
}

function isYamlMimeType(mimeType: string) {
  return (
    mimeType === "application/yaml" ||
    mimeType === "application/x-yaml" ||
    mimeType === "text/yaml" ||
    mimeType === "text/x-yaml" ||
    mimeType.endsWith("+yaml")
  )
}
