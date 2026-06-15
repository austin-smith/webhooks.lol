import "server-only"

import { publishRequest } from "@webhooks-lol/webhooks-server/endpoint-event-stream"
import {
  checkWebhookCaptureBodyAdmission,
  type AdmissionDecision,
} from "@webhooks-lol/webhooks-server/admission-control"
import { readTrustedClientIp } from "@webhooks-lol/webhooks-server/rate-limits/client-identity"
import {
  getEndpointResponseConfig,
  saveCapturedRequest,
} from "@webhooks-lol/webhooks-server/repository"
import type { RateLimitHeadersInput } from "@webhooks-lol/webhooks-server/rate-limits/http"
import type { EndpointResponseConfig } from "@webhooks-lol/webhooks-core/endpoint-response"
import type {
  CapturedRequest,
  CapturedRequestInput,
} from "@webhooks-lol/webhooks-core/types"

const MAX_BODY_BYTES = 1024 * 1024

class BodyTooLargeError extends Error {
  constructor() {
    super("Request body is too large.")
    this.name = "BodyTooLargeError"
  }
}

type CapturedBody = {
  text: string
  base64: string
  size: number
}

type InboundCaptureDeps = {
  checkWebhookCaptureBodyAdmission?: (input: {
    bodySize: number
    endpointId: string
    request: Request
  }) => Promise<AdmissionDecision>
  getEndpointResponseConfig: (
    endpointId: string
  ) => Promise<EndpointResponseConfig>
  publishRequest: (request: CapturedRequest) => void
  saveCapturedRequest: (input: CapturedRequestInput) => Promise<CapturedRequest>
}

export type InboundCaptureOutcome =
  | {
      kind: "captured"
      id: string
      response: EndpointResponseConfig
      endpointId: string
    }
  | {
      kind: "body-too-large"
      maxBodyBytes: number
    }
  | {
      kind: "rate-limited"
      rateLimit: RateLimitHeadersInput
    }

export function createInboundCapture({
  checkWebhookCaptureBodyAdmission = allowWebhookCaptureBodyAdmission,
  getEndpointResponseConfig,
  publishRequest,
  saveCapturedRequest,
}: InboundCaptureDeps) {
  return async function captureInboundRequest({
    request,
    endpointId,
  }: {
    request: Request
    endpointId: string
  }): Promise<InboundCaptureOutcome> {
    const requestUrl = new URL(request.url)
    const requestPath = readCapturedPath(requestUrl, endpointId)
    const requestTarget = `${requestPath}${requestUrl.search}`
    let body: CapturedBody

    try {
      body = await readBody(request)
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        return {
          kind: "body-too-large",
          maxBodyBytes: MAX_BODY_BYTES,
        }
      }

      throw error
    }

    const bodyAdmission = await checkWebhookCaptureBodyAdmission({
      bodySize: body.size,
      endpointId,
      request,
    })

    if (bodyAdmission.kind === "denied") {
      return {
        kind: "rate-limited",
        rateLimit: bodyAdmission.rateLimit,
      }
    }

    const capturedRequest = await saveCapturedRequest({
      endpointId,
      method: request.method,
      url: requestTarget,
      path: requestPath,
      query: readQuery(requestUrl),
      headers: Object.fromEntries(request.headers.entries()),
      bodyText: body.text,
      bodyBase64: body.base64,
      bodySize: body.size,
      contentType: request.headers.get("content-type"),
      ip: readTrustedClientIp(request),
    })

    publishRequest(capturedRequest)

    return {
      kind: "captured",
      id: capturedRequest.id,
      response: await getEndpointResponseConfig(endpointId),
      endpointId,
    }
  }
}

export const captureInboundRequest = createInboundCapture({
  checkWebhookCaptureBodyAdmission,
  getEndpointResponseConfig,
  publishRequest,
  saveCapturedRequest,
})

function allowWebhookCaptureBodyAdmission(): Promise<AdmissionDecision> {
  return Promise.resolve({
    kind: "allowed",
    clientIdentity: {
      key: "client:test",
      keyHash: null,
      source: "global",
    },
  })
}

async function readBody(request: Request): Promise<CapturedBody> {
  if (request.method === "GET" || request.method === "HEAD") {
    return {
      text: "",
      base64: "",
      size: 0,
    }
  }

  const contentLength = request.headers.get("content-length")
  const contentLengthBytes = contentLength ? Number(contentLength) : 0

  if (
    Number.isFinite(contentLengthBytes) &&
    contentLengthBytes > MAX_BODY_BYTES
  ) {
    throw new BodyTooLargeError()
  }

  if (!request.body) {
    return {
      text: "",
      base64: "",
      size: 0,
    }
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    size += value.byteLength

    if (size > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new BodyTooLargeError()
    }

    chunks.push(value)
  }

  const buffer = Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    size
  )
  const contentType = request.headers.get("content-type")

  return {
    text: isTextBody(contentType) ? buffer.toString("utf8") : "",
    base64: buffer.toString("base64"),
    size: buffer.length,
  }
}

function isTextBody(contentType: string | null) {
  if (!contentType) {
    return true
  }

  const normalized = contentType.toLowerCase()

  return (
    normalized.startsWith("text/") ||
    normalized.includes("json") ||
    normalized.includes("xml") ||
    normalized.includes("html") ||
    normalized.includes("javascript") ||
    normalized.includes("x-www-form-urlencoded") ||
    normalized.includes("yaml")
  )
}

function readQuery(url: URL) {
  const query: Record<string, string[]> = {}

  url.searchParams.forEach((value, key) => {
    query[key] = [...(query[key] ?? []), value]
  })

  return query
}

function readCapturedPath(url: URL, endpointId: string) {
  const endpointPath = `/api/hook/${endpointId}`

  if (url.pathname === endpointPath) {
    return "/"
  }

  if (url.pathname.startsWith(`${endpointPath}/`)) {
    return url.pathname.slice(endpointPath.length)
  }

  return "/"
}
