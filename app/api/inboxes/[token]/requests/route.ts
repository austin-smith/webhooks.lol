import { NO_STORE_HEADERS } from "@/lib/http/headers"
import type { RequestsResponse } from "@/lib/webhooks/api-contracts"
import { publishInboxCleared } from "@/lib/webhooks/inbox-event-stream"
import { clearRequests, listRequests } from "@/lib/webhooks/repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: RouteContext<"/api/inboxes/[token]/requests">
) {
  const { token } = await context.params
  const response = {
    token,
    requests: await listRequests(token),
  } satisfies RequestsResponse

  return Response.json(response, { headers: NO_STORE_HEADERS })
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/inboxes/[token]/requests">
) {
  const { token } = await context.params

  await clearRequests(token)
  publishInboxCleared(token)
  const response = {
    token,
    requests: [],
  } satisfies RequestsResponse

  return Response.json(response, { headers: NO_STORE_HEADERS })
}
