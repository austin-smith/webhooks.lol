import { EVENT_STREAM_HEADERS } from "@/lib/http/headers"
import { openInboxEventStream } from "@/lib/webhooks/inbox-event-stream"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  context: RouteContext<"/api/inboxes/[token]/events">
) {
  const { token } = await context.params
  const stream = openInboxEventStream({ signal: request.signal, token })

  return new Response(stream, {
    headers: EVENT_STREAM_HEADERS,
  })
}
