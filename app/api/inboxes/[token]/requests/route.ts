import { NO_STORE_HEADERS } from "@/lib/http-headers"
import { publishInboxCleared } from "@/lib/webhooks/events"
import { clearRequests, listRequests } from "@/lib/webhooks/repository"

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
      requests: await listRequests(token),
    },
    { headers: NO_STORE_HEADERS }
  )
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/inboxes/[token]/requests">
) {
  const { token } = await context.params

  await clearRequests(token)
  publishInboxCleared(token)

  return Response.json(
    {
      token,
      requests: [],
    },
    { headers: NO_STORE_HEADERS }
  )
}
