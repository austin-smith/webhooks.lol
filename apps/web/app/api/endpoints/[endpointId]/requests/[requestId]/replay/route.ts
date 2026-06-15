import { NO_STORE_HEADERS } from "@webhooks-lol/webhooks-server/http/headers"
import {
  createMissingClientIdentityHeaderResponse,
  createRateLimitedResponse,
  isMissingClientIdentityHeaderError,
} from "@webhooks-lol/webhooks-server/rate-limits/http"
import type { ReplayRequestResponse } from "@webhooks-lol/webhooks-core/api-contracts"
import { checkRequestReplayAdmission } from "@webhooks-lol/webhooks-server/admission-control"
import { parseEndpointId } from "@webhooks-lol/webhooks-core/endpoint-id"
import {
  createEndpointNotFoundResponse,
  createInvalidEndpointResponse,
} from "@webhooks-lol/webhooks-server/endpoint-route-responses"
import { isUuid } from "@webhooks-lol/webhooks-core/id-format"
import {
  isReplayBodyRateLimitedError,
  isReplayEndpointUnavailableError,
  isReplayRequestUnavailableError,
  replayCapturedRequest,
} from "@webhooks-lol/webhooks-server/request-replay/replay-request"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]/requests/[requestId]/replay">
) {
  const params = await readReplayRouteParams(context)

  if (params.kind === "invalid") {
    return params.response
  }

  let admission: Awaited<ReturnType<typeof checkRequestReplayAdmission>>

  try {
    admission = await checkRequestReplayAdmission({
      endpointId: params.endpointId,
      request,
      requestId: params.requestId,
    })
  } catch (error) {
    if (isMissingClientIdentityHeaderError(error)) {
      return createMissingClientIdentityHeaderResponse({
        error,
        headers: NO_STORE_HEADERS,
      })
    }

    throw error
  }

  if (admission.kind === "denied") {
    return createRateLimitedResponse({
      headers: NO_STORE_HEADERS,
      rateLimit: admission.rateLimit,
    })
  }

  try {
    const result = await replayCapturedRequest({
      endpointId: params.endpointId,
      request,
      requestId: params.requestId,
    })
    const response = result satisfies ReplayRequestResponse

    return Response.json(response, { headers: NO_STORE_HEADERS })
  } catch (error) {
    if (isReplayEndpointUnavailableError(error)) {
      return createEndpointNotFoundResponse()
    }

    if (isReplayRequestUnavailableError(error)) {
      return Response.json(
        { ok: false, error: "Request not found." },
        { headers: NO_STORE_HEADERS, status: 404 }
      )
    }

    if (isReplayBodyRateLimitedError(error)) {
      return createRateLimitedResponse({
        headers: NO_STORE_HEADERS,
        rateLimit: error.rateLimit,
      })
    }

    throw error
  }
}

async function readReplayRouteParams(
  context: RouteContext<"/api/endpoints/[endpointId]/requests/[requestId]/replay">
) {
  const { endpointId: rawEndpointId, requestId } = await context.params
  const endpointId = parseEndpointId(rawEndpointId)

  if (!endpointId) {
    return {
      kind: "invalid",
      response: createInvalidEndpointResponse(),
    } as const
  }

  if (!isUuid(requestId)) {
    return {
      kind: "invalid",
      response: Response.json(
        { ok: false, error: "Invalid request id." },
        { headers: NO_STORE_HEADERS, status: 400 }
      ),
    } as const
  }

  return {
    endpointId,
    kind: "valid",
    requestId: requestId.toLowerCase(),
  } as const
}
