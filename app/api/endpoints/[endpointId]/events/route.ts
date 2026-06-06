import { EVENT_STREAM_HEADERS } from "@/lib/http/headers"
import { openEndpointEventStream } from "@/lib/webhooks/endpoint-event-stream"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]/events">
) {
  const { endpointId } = await context.params
  const stream = openEndpointEventStream({
    signal: request.signal,
    endpointId,
  })

  return new Response(stream, {
    headers: EVENT_STREAM_HEADERS,
  })
}
