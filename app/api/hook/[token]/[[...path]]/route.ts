import { CORS_NO_STORE_HEADERS } from "@/lib/http/headers"
import { captureInboundRequest } from "@/lib/webhooks/inbound-capture"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function capture(
  request: Request,
  context: RouteContext<"/api/hook/[token]/[[...path]]">
) {
  const { token } = await context.params
  const outcome = await captureInboundRequest({ request, token })

  if (outcome.kind === "body-too-large") {
    return Response.json(
      {
        ok: false,
        error: "Request body too large.",
        maxBodyBytes: outcome.maxBodyBytes,
      },
      { headers: CORS_NO_STORE_HEADERS, status: 413 }
    )
  }

  if (request.method === "HEAD") {
    return new Response(null, { headers: CORS_NO_STORE_HEADERS, status: 204 })
  }

  return Response.json(
    {
      ok: true,
      id: outcome.id,
      token: outcome.token,
    },
    { headers: CORS_NO_STORE_HEADERS }
  )
}

export function OPTIONS() {
  return new Response(null, {
    headers: CORS_NO_STORE_HEADERS,
    status: 204,
  })
}

export {
  capture as DELETE,
  capture as GET,
  capture as HEAD,
  capture as PATCH,
  capture as POST,
  capture as PUT,
}
