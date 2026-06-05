import { NO_STORE_HEADERS } from "@/lib/http-headers"
import { publishInboxCleared } from "@/lib/webhook-events"
import { clearRequests, listRequests } from "@/lib/webhook-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: RouteContext<"/api/inboxes/[token]/requests">
) {
  const { token } = await context.params

  return Response.json(
    {
      token,
      requests: listRequests(token),
    },
    { headers: NO_STORE_HEADERS }
  )
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/inboxes/[token]/requests">
) {
  const { token } = await context.params

  clearRequests(token)
  publishInboxCleared(token)

  return Response.json(
    {
      token,
      requests: [],
    },
    { headers: NO_STORE_HEADERS }
  )
}
