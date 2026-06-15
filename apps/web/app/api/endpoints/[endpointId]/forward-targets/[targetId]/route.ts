import { NO_STORE_HEADERS } from "@webhooks-lol/webhooks-server/http/headers"
import {
  readBoundedTextBody,
  RequestBodyTooLargeError,
} from "@webhooks-lol/webhooks-server/http/request-body"
import type {
  EndpointForwardTargetResponse,
  UpdateEndpointForwardTargetRequest,
} from "@webhooks-lol/webhooks-core/api-contracts"
import { parseEndpointId } from "@webhooks-lol/webhooks-core/endpoint-id"
import { EndpointForwardTargetValidationError } from "@webhooks-lol/webhooks-server/endpoint-forwarding/policy"
import {
  deleteEndpointForwardTarget,
  isEndpointForwardingEndpointUnavailableError,
  isEndpointForwardTargetUnavailableError,
  updateEndpointForwardTarget,
} from "@webhooks-lol/webhooks-server/endpoint-forwarding/repository"
import {
  createEndpointNotFoundResponse,
  createInvalidEndpointResponse,
} from "@webhooks-lol/webhooks-server/endpoint-route-responses"
import { isUuid } from "@webhooks-lol/webhooks-core/id-format"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const MAX_ENDPOINT_FORWARD_TARGET_REQUEST_BYTES = 4096

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]/forward-targets/[targetId]">
) {
  const params = await readEndpointForwardTargetRouteParams(context)

  if (params.kind === "invalid") {
    return params.response
  }

  const parsed = await readUpdateEndpointForwardTargetRequest(request)

  if (parsed.kind === "invalid") {
    return createEndpointForwardTargetValidationResponse(parsed.error)
  }

  try {
    const response = {
      endpointId: params.endpointId,
      target: await updateEndpointForwardTarget({
        endpointId: params.endpointId,
        targetId: params.targetId,
        ...parsed.value,
      }),
    } satisfies EndpointForwardTargetResponse

    return Response.json(response, { headers: NO_STORE_HEADERS })
  } catch (error) {
    return handleEndpointForwardTargetUpdateError(error)
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]/forward-targets/[targetId]">
) {
  const params = await readEndpointForwardTargetRouteParams(context)

  if (params.kind === "invalid") {
    return params.response
  }

  try {
    await deleteEndpointForwardTarget({
      endpointId: params.endpointId,
      targetId: params.targetId,
    })

    return new Response(null, { headers: NO_STORE_HEADERS, status: 204 })
  } catch (error) {
    return handleEndpointForwardTargetUpdateError(error)
  }
}

async function readEndpointForwardTargetRouteParams(
  context: RouteContext<"/api/endpoints/[endpointId]/forward-targets/[targetId]">
) {
  const { endpointId: rawEndpointId, targetId } = await context.params
  const endpointId = parseEndpointId(rawEndpointId)

  if (!endpointId) {
    return {
      kind: "invalid",
      response: createInvalidEndpointResponse(),
    } as const
  }

  if (!isUuid(targetId)) {
    return {
      kind: "invalid",
      response: Response.json(
        { ok: false, error: "Invalid forward target id." },
        { headers: NO_STORE_HEADERS, status: 400 }
      ),
    } as const
  }

  return {
    endpointId,
    kind: "valid",
    targetId,
  } as const
}

async function readUpdateEndpointForwardTargetRequest(request: Request) {
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
      error: "Forward target update is required.",
    } as const
  }

  const candidate = body as Partial<UpdateEndpointForwardTargetRequest>
  const value: UpdateEndpointForwardTargetRequest = {}

  if (candidate.url !== undefined) {
    if (typeof candidate.url !== "string" || !candidate.url.trim()) {
      return {
        kind: "invalid",
        error: "Forward URL must be a non-empty string.",
      } as const
    }

    value.url = candidate.url
  }

  if (candidate.pathMode !== undefined) {
    if (typeof candidate.pathMode !== "string") {
      return {
        kind: "invalid",
        error: "Forward path mode must be a string.",
      } as const
    }

    value.pathMode = candidate.pathMode
  }

  if (candidate.enabled !== undefined) {
    if (typeof candidate.enabled !== "boolean") {
      return {
        kind: "invalid",
        error: "Forward target enabled must be a boolean.",
      } as const
    }

    value.enabled = candidate.enabled
  }

  if (
    value.url === undefined &&
    value.pathMode === undefined &&
    value.enabled === undefined
  ) {
    return {
      kind: "invalid",
      error: "Forward target update must include url, pathMode, or enabled.",
    } as const
  }

  return {
    kind: "valid",
    value,
  } as const
}

function handleEndpointForwardTargetUpdateError(error: unknown) {
  if (isEndpointForwardingEndpointUnavailableError(error)) {
    return createEndpointNotFoundResponse()
  }

  if (isEndpointForwardTargetUnavailableError(error)) {
    return Response.json(
      { ok: false, error: "Forward target not found." },
      { headers: NO_STORE_HEADERS, status: 404 }
    )
  }

  if (error instanceof EndpointForwardTargetValidationError) {
    return createEndpointForwardTargetValidationResponse(error.message)
  }

  throw error
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
