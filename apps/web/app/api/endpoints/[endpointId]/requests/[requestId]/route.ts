import { NO_STORE_HEADERS } from "@webhooks-lol/webhooks-server/http/headers"
import type { RequestResponse } from "@webhooks-lol/webhooks-core/api-contracts"
import { parseEndpointId } from "@webhooks-lol/webhooks-core/endpoint-id"
import {
  createEndpointNotFoundResponse,
  createInvalidEndpointResponse,
} from "@webhooks-lol/webhooks-server/endpoint-route-responses"
import {
  getRequest,
  isEndpointUnavailableError,
} from "@webhooks-lol/webhooks-server/repository"
import { isUuid } from "@webhooks-lol/webhooks-core/id-format"

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
