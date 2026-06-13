import { NO_STORE_HEADERS } from "@/lib/http/headers"
import type { RequestResponse } from "@/lib/webhooks/api-contracts"
import { parseEndpointId } from "@/lib/webhooks/endpoint-id"
import {
  createEndpointNotFoundResponse,
  createInvalidEndpointResponse,
} from "@/lib/webhooks/endpoint-route-responses"
import {
  getRequest,
  isEndpointUnavailableError,
} from "@/lib/webhooks/repository"
import { isUuid } from "@/lib/webhooks/id-format"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]/requests/[requestId]">
) {
  const { endpointId: rawEndpointId, requestId } = await context.params
  const endpointId = parseEndpointId(rawEndpointId)

  if (!endpointId) {
    return createInvalidEndpointResponse()
  }

  if (!isUuid(requestId)) {
    return Response.json(
      { ok: false, error: "Invalid request id." },
      { headers: NO_STORE_HEADERS, status: 400 }
    )
  }

  let captured: Awaited<ReturnType<typeof getRequest>>

  try {
    captured = await getRequest(endpointId, requestId)
  } catch (error) {
    if (isEndpointUnavailableError(error)) {
      return createEndpointNotFoundResponse()
    }

    throw error
  }

  if (!captured) {
    return Response.json(
      { ok: false, error: "Request not found." },
      { headers: NO_STORE_HEADERS, status: 404 }
    )
  }

  const response = {
    endpointId,
    request: captured,
  } satisfies RequestResponse

  return Response.json(response, { headers: NO_STORE_HEADERS })
}
