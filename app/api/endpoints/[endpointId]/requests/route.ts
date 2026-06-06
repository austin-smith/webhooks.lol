import { NO_STORE_HEADERS } from "@/lib/http/headers"
import type { RequestsResponse } from "@/lib/webhooks/api-contracts"
import { publishEndpointCleared } from "@/lib/webhooks/endpoint-event-stream"
import { clearRequests, listRequests } from "@/lib/webhooks/repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]/requests">
) {
  const { endpointId } = await context.params
  const response = {
    endpointId,
    requests: await listRequests(endpointId),
  } satisfies RequestsResponse

  return Response.json(response, { headers: NO_STORE_HEADERS })
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]/requests">
) {
  const { endpointId } = await context.params

  await clearRequests(endpointId)
  publishEndpointCleared(endpointId)
  const response = {
    endpointId,
    requests: [],
  } satisfies RequestsResponse

  return Response.json(response, { headers: NO_STORE_HEADERS })
}
