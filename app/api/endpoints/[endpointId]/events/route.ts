import { EVENT_STREAM_HEADERS, NO_STORE_HEADERS } from "@/lib/http/headers"
import { createRateLimitedResponse } from "@/lib/rate-limits/http"
import { acquireEndpointEventStreamAdmission } from "@/lib/webhooks/admission-control"
import { parseEndpointId } from "@/lib/webhooks/endpoint-id"
import { openEndpointEventStream } from "@/lib/webhooks/endpoint-event-stream"
import {
  getEndpoint,
  isEndpointUnavailableError,
} from "@/lib/webhooks/repository"
import {
  createEndpointNotFoundResponse,
  createInvalidEndpointResponse,
} from "@/lib/webhooks/endpoint-route-responses"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]/events">
) {
  const { endpointId: rawEndpointId } = await context.params
  const endpointId = parseEndpointId(rawEndpointId)

  if (!endpointId) {
    return createInvalidEndpointResponse()
  }

  const admission = await acquireEndpointEventStreamAdmission({
    endpointId,
    request,
  })

  if (admission.kind === "denied") {
    return createRateLimitedResponse({
      headers: NO_STORE_HEADERS,
      rateLimit: admission.rateLimit,
    })
  }

  try {
    await getEndpoint(endpointId)
  } catch (error) {
    await admission.lease.release()

    if (isEndpointUnavailableError(error)) {
      return createEndpointNotFoundResponse()
    }

    throw error
  }

  const stream = openEndpointEventStream({
    lease: admission.lease,
    signal: request.signal,
    endpointId,
  })

  return new Response(stream, {
    headers: EVENT_STREAM_HEADERS,
  })
}
