import { NO_STORE_HEADERS } from "@webhooks-lol/webhooks-server/http/headers"
import {
  readBoundedTextBody,
  RequestBodyTooLargeError,
} from "@webhooks-lol/webhooks-server/http/request-body"
import type {
  CreateEndpointForwardTargetRequest,
  EndpointForwardTargetResponse,
  EndpointForwardTargetsResponse,
} from "@webhooks-lol/webhooks-core/api-contracts"
import { parseEndpointId } from "@webhooks-lol/webhooks-core/endpoint-id"
import { EndpointForwardTargetValidationError } from "@webhooks-lol/webhooks-server/endpoint-forwarding/policy"
import {
  createEndpointForwardTarget,
  isEndpointForwardingEndpointUnavailableError,
  listEndpointForwardTargets,
} from "@webhooks-lol/webhooks-server/endpoint-forwarding/repository"
import {
  createEndpointNotFoundResponse,
  createInvalidEndpointResponse,
} from "@webhooks-lol/webhooks-server/endpoint-route-responses"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const MAX_ENDPOINT_FORWARD_TARGET_REQUEST_BYTES = 4096

export async function GET(
  _request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]/forward-targets">
) {
  const { endpointId: rawEndpointId } = await context.params
  const endpointId = parseEndpointId(rawEndpointId)

  if (!endpointId) {
    return createInvalidEndpointResponse()
  }

  try {
    const response = {
      endpointId,
      targets: await listEndpointForwardTargets(endpointId),
    } satisfies EndpointForwardTargetsResponse

    return Response.json(response, { headers: NO_STORE_HEADERS })
  } catch (error) {
    if (isEndpointForwardingEndpointUnavailableError(error)) {
      return createEndpointNotFoundResponse()
    }

    throw error
  }
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]/forward-targets">
) {
  const { endpointId: rawEndpointId } = await context.params
  const endpointId = parseEndpointId(rawEndpointId)

  if (!endpointId) {
    return createInvalidEndpointResponse()
  }

  const parsed = await readCreateEndpointForwardTargetRequest(request)

  if (parsed.kind === "invalid") {
    return createEndpointForwardTargetValidationResponse(parsed.error)
  }

  try {
    const response = {
      endpointId,
      target: await createEndpointForwardTarget({
        endpointId,
        pathMode: parsed.value.pathMode,
        url: parsed.value.url,
      }),
    } satisfies EndpointForwardTargetResponse

    return Response.json(response, {
      headers: NO_STORE_HEADERS,
      status: 201,
    })
  } catch (error) {
    if (isEndpointForwardingEndpointUnavailableError(error)) {
      return createEndpointNotFoundResponse()
    }

    if (error instanceof EndpointForwardTargetValidationError) {
      return createEndpointForwardTargetValidationResponse(error.message)
    }

    throw error
  }
}

async function readCreateEndpointForwardTargetRequest(request: Request) {
  let body: unknown

  try {
    body = JSON.parse(
      await readBoundedTextBody(
        request,
        MAX_ENDPOINT_FORWARD_TARGET_REQUEST_BYTES
      )
    ) as unknown
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return {
        kind: "invalid",
        error: "Request body too large.",
      } as const
    }

    return {
      kind: "invalid",
      error: "Request body must be valid JSON.",
    } as const
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      kind: "invalid",
      error: "Forward target configuration is required.",
    } as const
  }

  const candidate = body as Partial<CreateEndpointForwardTargetRequest>

  if (typeof candidate.url !== "string" || !candidate.url.trim()) {
    return {
      kind: "invalid",
      error: "Forward URL is required.",
    } as const
  }

  if (
    candidate.pathMode !== undefined &&
    typeof candidate.pathMode !== "string"
  ) {
    return {
      kind: "invalid",
      error: "Forward path mode must be a string.",
    } as const
  }

  return {
    kind: "valid",
    value: {
      pathMode: candidate.pathMode,
      url: candidate.url,
    },
  } as const
}

function createEndpointForwardTargetValidationResponse(error: string) {
  return Response.json(
    {
      ok: false,
      error,
    },
    { headers: NO_STORE_HEADERS, status: 400 }
  )
}
