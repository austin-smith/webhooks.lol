import { publishRequest } from "@/lib/webhooks/endpoint-event-stream"
import {
  checkWebhookCaptureBodyAdmission,
  type AdmissionDecision,
} from "@/lib/webhooks/admission-control"
import type { RateLimitHeadersInput } from "@/lib/rate-limits/http"
import {
  getRequest,
  isEndpointUnavailableError,
  saveReplayedCapturedRequest,
} from "@/lib/webhooks/repository"
import type { ReplayRequestResult } from "@/lib/webhooks/request-replay/types"

export class ReplayRequestNotFoundError extends Error {
  constructor(requestId: string) {
    super(`Request ${requestId} was not found.`)
    this.name = "ReplayRequestNotFoundError"
  }
}

export class ReplayEndpointNotFoundError extends Error {
  constructor(endpointId: string) {
    super(`Endpoint ${endpointId} was not found.`)
    this.name = "ReplayEndpointNotFoundError"
  }
}

export class ReplayBodyRateLimitedError extends Error {
  readonly rateLimit: RateLimitHeadersInput

  constructor(rateLimit: RateLimitHeadersInput) {
    super("Replay body byte admission was rate limited.")
    this.name = "ReplayBodyRateLimitedError"
    this.rateLimit = rateLimit
  }
}

export async function replayCapturedRequest({
  endpointId,
  request,
  requestId,
}: {
  endpointId: string
  request: Request
  requestId: string
}): Promise<ReplayRequestResult> {
  const sourceRequest = await loadReplayRequest({ endpointId, requestId })
  const bodyAdmission = await checkReplayBodyAdmission({
    bodySize: sourceRequest.bodySize,
    endpointId,
    request,
  })

  if (bodyAdmission.kind === "denied") {
    throw new ReplayBodyRateLimitedError(bodyAdmission.rateLimit)
  }

  const replayedRequest = await saveReplayedCapturedRequest({
    bodyBase64: sourceRequest.bodyBase64,
    bodySize: sourceRequest.bodySize,
    bodyText: sourceRequest.bodyText,
    contentType: sourceRequest.contentType,
    endpointId: sourceRequest.endpointId,
    headers: sourceRequest.headers,
    ip: sourceRequest.ip,
    method: sourceRequest.method,
    path: sourceRequest.path,
    query: sourceRequest.query,
    url: sourceRequest.url,
  })
  publishRequest(replayedRequest)

  return {
    endpointId,
    originalRequestId: requestId,
    request: replayedRequest,
  }
}

export function isReplayEndpointUnavailableError(error: unknown) {
  return (
    error instanceof ReplayEndpointNotFoundError ||
    isEndpointUnavailableError(error)
  )
}

export function isReplayRequestUnavailableError(error: unknown) {
  return error instanceof ReplayRequestNotFoundError
}

export function isReplayBodyRateLimitedError(
  error: unknown
): error is ReplayBodyRateLimitedError {
  return error instanceof ReplayBodyRateLimitedError
}

async function checkReplayBodyAdmission({
  bodySize,
  endpointId,
  request,
}: {
  bodySize: number
  endpointId: string
  request: Request
}): Promise<AdmissionDecision> {
  return checkWebhookCaptureBodyAdmission({
    bodySize,
    endpointId,
    request,
  })
}

async function loadReplayRequest({
  endpointId,
  requestId,
}: {
  endpointId: string
  requestId: string
}) {
  let request: Awaited<ReturnType<typeof getRequest>>

  try {
    request = await getRequest(endpointId, requestId)
  } catch (error) {
    if (isEndpointUnavailableError(error)) {
      throw new ReplayEndpointNotFoundError(endpointId)
    }

    throw error
  }

  if (!request) {
    throw new ReplayRequestNotFoundError(requestId)
  }

  return request
}
