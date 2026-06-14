import { Buffer } from "node:buffer"

import type { EndpointForwardPathMode } from "@/lib/webhooks/endpoint-forwarding/policy"
import type { CapturedRequest } from "@/lib/webhooks/types"

const HOP_BY_HOP_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
  "proxy-authorization",
  "proxy-authenticate",
])

export function buildEndpointForwardTargetUrl({
  targetUrl,
  pathMode,
  request,
}: {
  targetUrl: string
  pathMode: EndpointForwardPathMode
  request: CapturedRequest
}): URL {
  const url = new URL(targetUrl)

  if (pathMode === "preserve" && request.path && request.path !== "/") {
    url.pathname = joinPath(url.pathname, request.path)
  }

  appendRawSearch(url, readRawSearch(request.url))

  return url
}

export function buildEndpointForwardHeaders({
  deliveryId,
  attempt,
  request,
}: {
  deliveryId: string
  attempt: number
  request: CapturedRequest
}): Headers {
  const headers = new Headers()

  for (const [name, value] of Object.entries(request.headers)) {
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      continue
    }

    headers.set(name, value)
  }

  headers.set("x-webhookslol-endpoint", request.endpointId)
  headers.set("x-webhookslol-request-id", request.id)
  headers.set("x-webhookslol-delivery-id", deliveryId)
  headers.set("x-webhookslol-attempt", String(attempt))
  headers.set("x-webhookslol-received-at", request.receivedAt)

  return headers
}

export function buildEndpointForwardBody(
  request: CapturedRequest
): ArrayBuffer | undefined {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined
  }

  if (!request.bodyBase64) {
    return undefined
  }

  const body = Buffer.from(request.bodyBase64, "base64")

  return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)
}

function joinPath(base: string, sub: string): string {
  const left = base.endsWith("/") ? base.slice(0, -1) : base
  const right = sub.startsWith("/") ? sub : `/${sub}`
  return `${left}${right}`
}

function readRawSearch(capturedUrl: string) {
  const queryStart = capturedUrl.indexOf("?")

  if (queryStart === -1) {
    return ""
  }

  const hashStart = capturedUrl.indexOf("#", queryStart)
  const search = capturedUrl.slice(
    queryStart,
    hashStart === -1 ? undefined : hashStart
  )

  return search === "?" ? "" : search
}

function appendRawSearch(url: URL, rawSearch: string) {
  if (!rawSearch) {
    return
  }

  if (!url.search) {
    url.search = rawSearch
    return
  }

  url.search = `${url.search}&${rawSearch.slice(1)}`
}
