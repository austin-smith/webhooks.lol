import { NO_STORE_HEADERS } from "@webhooks-lol/webhooks-server/http/headers"
import type { EndpointStatsResponse } from "@webhooks-lol/webhooks-core/api-contracts"
import { parseEndpointId } from "@webhooks-lol/webhooks-core/endpoint-id"
import {
  getEndpointStats,
  isEndpointUnavailableError,
} from "@webhooks-lol/webhooks-server/repository"
import {
  createEndpointNotFoundResponse,
  createInvalidEndpointResponse,
} from "@webhooks-lol/webhooks-server/endpoint-route-responses"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]/stats">
) {
  const { endpointId: rawEndpointId } = await context.params
  const endpointId = parseEndpointId(rawEndpointId)

  if (!endpointId) {
    return createInvalidEndpointResponse()
  }

  let response: Awaited<ReturnType<typeof getEndpointStats>>

  try {
    response = await getEndpointStats(endpointId)
  } catch (error) {
    if (isEndpointUnavailableError(error)) {
      return createEndpointNotFoundResponse()
    }

    throw error
  }

  return Response.json(response satisfies EndpointStatsResponse, {
    headers: NO_STORE_HEADERS,
  })
}
