import { getEndpointAccessActor } from "@/lib/auth/endpoint-access"
import {
  EVENT_STREAM_HEADERS,
  NO_STORE_HEADERS,
} from "@webhooks-lol/webhooks-server/http/headers"
import {
  createMissingClientIdentityHeaderResponse,
  createRateLimitedResponse,
  createRateLimitServiceUnavailableResponse,
  isMissingClientIdentityHeaderError,
  isRateLimitStoreUnavailableError,
} from "@webhooks-lol/webhooks-server/rate-limits/http"
import { acquireEndpointEventStreamAdmission } from "@webhooks-lol/webhooks-server/admission-control"
import { parseEndpointId } from "@webhooks-lol/webhooks-core/endpoint-id"
import { openEndpointEventStream } from "@webhooks-lol/webhooks-server/endpoint-event-stream"
import {
  assertEndpointAccessibleToActor,
  isEndpointUnavailableError,
} from "@webhooks-lol/webhooks-server/repository"
import {
  createEndpointNotFoundResponse,
  createInvalidEndpointResponse,
} from "@webhooks-lol/webhooks-server/endpoint-route-responses"

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

  let admission: Awaited<ReturnType<typeof acquireEndpointEventStreamAdmission>>

  try {
    admission = await acquireEndpointEventStreamAdmission({
      endpointId,
      request,
    })
  } catch (error) {
    if (isMissingClientIdentityHeaderError(error)) {
      return createMissingClientIdentityHeaderResponse({
        error,
        headers: NO_STORE_HEADERS,
      })
    }

    if (isRateLimitStoreUnavailableError(error)) {
      return createRateLimitServiceUnavailableResponse({
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
    await assertEndpointAccessibleToActor(
      endpointId,
      await getEndpointAccessActor(request)
    )
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
