import {
  CORS_NO_STORE_HEADERS,
  WEBHOOK_RESPONSE_SECURITY_HEADERS,
} from "@webhooks-lol/webhooks-server/http/headers"
import {
  createMissingClientIdentityHeaderResponse,
  createRateLimitedResponse,
  isMissingClientIdentityHeaderError,
} from "@webhooks-lol/webhooks-server/rate-limits/http"
import { checkWebhookCaptureAdmission } from "@webhooks-lol/webhooks-server/admission-control"
import { parseEndpointId } from "@webhooks-lol/webhooks-core/endpoint-id"
import { captureInboundRequest } from "@webhooks-lol/webhooks-server/inbound-capture"
import {
  renderEndpointResponseBodyTemplate,
  type EndpointResponseConfig,
} from "@webhooks-lol/webhooks-core/endpoint-response"
import { isEndpointUnavailableError } from "@webhooks-lol/webhooks-server/repository"
import {
  createEndpointNotFoundResponse,
  createInvalidEndpointResponse,
} from "@webhooks-lol/webhooks-server/endpoint-route-responses"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function capture(
  request: Request,
  context: RouteContext<"/api/hook/[endpointId]/[[...path]]">
) {
  const { endpointId: rawEndpointId } = await context.params
  const endpointId = parseEndpointId(rawEndpointId)

  if (!endpointId) {
    return createInvalidEndpointResponse(CORS_NO_STORE_HEADERS)
  }

  let admission: Awaited<ReturnType<typeof checkWebhookCaptureAdmission>>

  try {
    admission = await checkWebhookCaptureAdmission({ endpointId, request })
  } catch (error) {
    if (isMissingClientIdentityHeaderError(error)) {
      return createMissingClientIdentityHeaderResponse({
        error,
        headers: CORS_NO_STORE_HEADERS,
      })
    }

    throw error
  }

  if (admission.kind === "denied") {
    return createRateLimitedResponse({
      headers: CORS_NO_STORE_HEADERS,
      rateLimit: admission.rateLimit,
    })
  }

  let outcome: Awaited<ReturnType<typeof captureInboundRequest>>

  try {
    outcome = await captureInboundRequest({ request, endpointId })
  } catch (error) {
    if (isEndpointUnavailableError(error)) {
      return createEndpointNotFoundResponse(CORS_NO_STORE_HEADERS)
    }

    throw error
  }

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

  if (outcome.kind === "rate-limited") {
    return createRateLimitedResponse({
      headers: CORS_NO_STORE_HEADERS,
      rateLimit: outcome.rateLimit,
    })
  }

  return createCapturedResponse({
    id: outcome.id,
    method: request.method,
    response: outcome.response,
    endpointId: outcome.endpointId,
  })
}

export function OPTIONS(
  request: Request,
  context: RouteContext<"/api/hook/[endpointId]/[[...path]]">
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
  endpointId,
}: {
  id: string
  method: string
  response: EndpointResponseConfig
  endpointId: string
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
        endpointId,
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
      : renderEndpointResponseBodyTemplate(response.body, {
          endpointId: endpointId,
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
