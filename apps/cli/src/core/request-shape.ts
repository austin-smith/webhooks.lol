import { Buffer } from "node:buffer"

import type { CapturedRequest } from "./types.js"

export type PathMode = "preserve" | "strip"

// Headers that describe a specific hop or are recomputed by the HTTP client.
// Everything else — including provider signature headers like stripe-signature
// and x-hub-signature-256 — is forwarded verbatim so local verification passes.
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

// Builds the local target URL from the --to base and the captured request.
// In "preserve" mode the captured subpath is appended to the base path; in
// "strip" mode the base path is used verbatim. Captured query is always merged.
export function buildTargetUrl(
  target: string,
  request: CapturedRequest,
  pathMode: PathMode
): URL {
  const url = new URL(target)

  if (pathMode === "preserve" && request.path && request.path !== "/") {
    url.pathname = joinPath(url.pathname, request.path)
  }

  appendRawSearch(url, readRawSearch(request.url))

  return url
}

export function buildForwardHeaders(request: CapturedRequest): Headers {
  const headers = new Headers()

  for (const [name, value] of Object.entries(request.headers)) {
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      continue
    }

    headers.set(name, value)
  }

  headers.set("x-webhookslol-endpoint", request.endpointId)
  headers.set("x-webhookslol-request-id", request.id)
  headers.set("x-webhookslol-received-at", request.receivedAt)

  return headers
}

// Reconstructs the original body bytes from the authoritative base64 capture,
// preserving exact bytes for binary payloads and signature verification.
export function buildRequestBody(
  request: CapturedRequest
): Uint8Array | undefined {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined
  }

  if (!request.bodyBase64) {
    return undefined
  }

  return new Uint8Array(Buffer.from(request.bodyBase64, "base64"))
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
