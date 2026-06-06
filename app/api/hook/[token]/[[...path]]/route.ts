import {
  CORS_NO_STORE_HEADERS,
  WEBHOOK_RESPONSE_SECURITY_HEADERS,
} from "@/lib/http/headers"
import { captureInboundRequest } from "@/lib/webhooks/inbound-capture"
import {
  renderInboxResponseBodyTemplate,
  type InboxResponseConfig,
} from "@/lib/webhooks/inbox-response"

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

  return createCapturedResponse({
    id: outcome.id,
    method: request.method,
    response: outcome.response,
    token: outcome.token,
  })
}

export function OPTIONS(
  request: Request,
  context: RouteContext<"/api/hook/[token]/[[...path]]">
) {
  if (!isCorsPreflightRequest(request)) {
    return capture(request, context)
  }

  return new Response(null, {
    headers: CORS_NO_STORE_HEADERS,
    status: 204,
  })
}

function isCorsPreflightRequest(request: Request) {
  return (
    request.headers.has("origin") &&
    request.headers.has("access-control-request-method")
  )
}

function createCapturedResponse({
  id,
  method,
  response,
  token,
}: {
  id: string
  method: string
  response: InboxResponseConfig
  token: string
}) {
  if (response.mode === "default") {
    if (method === "HEAD") {
      return new Response(null, {
        headers: CORS_NO_STORE_HEADERS,
        status: 204,
      })
    }

    return Response.json(
      {
        ok: true,
        id,
        token,
      },
      { headers: CORS_NO_STORE_HEADERS }
    )
  }

  const headers = new Headers(CORS_NO_STORE_HEADERS)
  headers.set("Content-Type", response.contentType)

  for (const [name, value] of Object.entries(
    WEBHOOK_RESPONSE_SECURITY_HEADERS
  )) {
    headers.set(name, value)
  }

  const body =
    method === "HEAD" || responseStatusForbidsBody(response.status)
      ? null
      : renderInboxResponseBodyTemplate(response.body, {
          inboxToken: token,
          requestId: id,
        })

  return new Response(body, {
    headers,
    status: response.status,
  })
}

function responseStatusForbidsBody(status: number) {
  return status === 204 || status === 205 || status === 304
}

export {
  capture as DELETE,
  capture as GET,
  capture as HEAD,
  capture as PATCH,
  capture as POST,
  capture as PUT,
}
