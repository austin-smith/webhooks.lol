import type { CapturedRequest } from "@webhooks-lol/webhooks-core/types"

import { formatRequestTarget } from "./request-formatters"

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

export type RequestCopyFormat = "curl" | "fetch" | "cli"

export function formatRequestAsCurl({
  request,
  webhookUrl,
}: {
  request: CapturedRequest
  webhookUrl: string
}) {
  const parts = [
    `--request ${quoteShellToken(request.method)}`,
    `--url ${quoteShellToken(formatWebhookRequestUrl({ request, webhookUrl }))}`,
    ...formatCopyHeaders(request).map(
      ([name, value]) => `--header ${quoteShellToken(`${name}: ${value}`)}`
    ),
  ]

  if (!requestHasBody(request)) {
    return joinCurlParts(parts)
  }

  if (request.bodyText) {
    return joinCurlParts([
      ...parts,
      `--data-binary ${quoteShellToken(request.bodyText)}`,
    ])
  }

  return [
    `printf %s ${quoteShellToken(request.bodyBase64)} | base64 --decode | \\`,
    joinCurlParts([...parts, "--data-binary @-"]),
  ].join("\n")
}

export function formatRequestAsFetch({
  request,
  webhookUrl,
}: {
  request: CapturedRequest
  webhookUrl: string
}) {
  const properties = [`method: ${JSON.stringify(request.method)}`]
  const headers = formatCopyHeaders(request)

  if (headers.length > 0) {
    properties.push(
      [
        "headers: {",
        ...headers.map(
          ([name, value]) =>
            `  ${JSON.stringify(name)}: ${JSON.stringify(value)},`
        ),
        "}",
      ].join("\n")
    )
  }

  if (requestHasBody(request)) {
    if (request.bodyText) {
      properties.push(`body: ${JSON.stringify(request.bodyText)}`)
    } else {
      properties.push(
        `body: Uint8Array.from(atob(${JSON.stringify(request.bodyBase64)}), (byte) => byte.charCodeAt(0))`
      )
    }
  }

  return [
    `await fetch(${JSON.stringify(formatWebhookRequestUrl({ request, webhookUrl }))}, {`,
    ...properties.map((property, index) =>
      formatFetchProperty(property, index < properties.length - 1)
    ),
    "})",
  ].join("\n")
}

export function formatRequestAsCliCommand({
  request,
}: {
  request: CapturedRequest
}) {
  return [
    "npx whlol replay",
    quoteShellToken(request.endpointId),
    "--request",
    quoteShellToken(request.id),
  ].join(" ")
}

export function formatWebhookRequestUrl({
  request,
  webhookUrl,
}: {
  request: CapturedRequest
  webhookUrl: string
}) {
  const baseUrl = webhookUrl.trim().replace(/\/+$/, "")
  const requestTarget = formatRequestTarget(request)

  if (!requestTarget || requestTarget === "/") {
    return baseUrl
  }

  if (requestTarget.startsWith("/?")) {
    return `${baseUrl}${requestTarget.slice(1)}`
  }

  if (requestTarget.startsWith("?")) {
    return `${baseUrl}${requestTarget}`
  }

  if (requestTarget.startsWith("/")) {
    return `${baseUrl}${requestTarget}`
  }

  return `${baseUrl}/${requestTarget}`
}

function formatCopyHeaders(request: CapturedRequest) {
  return Object.entries(request.headers)
    .filter(([name]) => !HOP_BY_HOP_HEADERS.has(name.toLowerCase()))
    .sort(([left], [right]) => left.localeCompare(right))
}

function requestHasBody(request: CapturedRequest) {
  return (
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    Boolean(request.bodyText || request.bodyBase64)
  )
}

function joinCurlParts(parts: string[]) {
  return ["curl \\", ...parts.map(formatCurlPartLine)].join("\n")
}

function formatCurlPartLine(part: string, index: number, parts: string[]) {
  return `  ${part}${index === parts.length - 1 ? "" : " \\"}`
}

function formatFetchProperty(property: string, needsComma: boolean) {
  const lines = property.split("\n")

  return lines
    .map((line, index) => {
      const isLastLine = index === lines.length - 1
      return `  ${line}${isLastLine && needsComma ? "," : ""}`
    })
    .join("\n")
}

function quoteShellToken(value: string) {
  if (!value) {
    return "''"
  }

  return `'${value.replaceAll("'", "'\\''")}'`
}
