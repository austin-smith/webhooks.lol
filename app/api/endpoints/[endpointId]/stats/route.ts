import { NO_STORE_HEADERS } from "@/lib/http/headers"
import type { EndpointStatsResponse } from "@/lib/webhooks/api-contracts"
import { parseEndpointId } from "@/lib/webhooks/endpoint-id"
import {
  getEndpointStats,
  isEndpointUnavailableError,
} from "@/lib/webhooks/repository"
import {
  createEndpointNotFoundResponse,
  createInvalidEndpointResponse,
} from "@/lib/webhooks/endpoint-route-responses"

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
