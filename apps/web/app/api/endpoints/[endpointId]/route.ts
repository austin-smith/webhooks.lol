import { NO_STORE_HEADERS } from "@webhooks-lol/webhooks-server/http/headers"
import {
  readBoundedTextBody,
  RequestBodyTooLargeError,
} from "@webhooks-lol/webhooks-server/http/request-body"
import type {
  EndpointMetadataResponse,
  UpdateEndpointMetadataRequest,
} from "@webhooks-lol/webhooks-core/api-contracts"
import { parseEndpointId } from "@webhooks-lol/webhooks-core/endpoint-id"
import {
  getEndpoint,
  isEndpointUnavailableError,
  MAX_ENDPOINT_NAME_LENGTH,
  updateEndpointName,
} from "@webhooks-lol/webhooks-server/repository"
import {
  createEndpointNotFoundResponse,
  createInvalidEndpointResponse,
} from "@webhooks-lol/webhooks-server/endpoint-route-responses"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const MAX_ENDPOINT_METADATA_REQUEST_BYTES = 1024

export async function GET(
  _request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]">
) {
  const { endpointId: rawEndpointId } = await context.params
  const endpointId = parseEndpointId(rawEndpointId)

  if (!endpointId) {
    return createInvalidEndpointResponse()
  }

  let response: Awaited<ReturnType<typeof getEndpoint>>

  try {
    response = await getEndpoint(endpointId)
  } catch (error) {
    if (isEndpointUnavailableError(error)) {
      return createEndpointNotFoundResponse()
    }

    throw error
  }

  return Response.json(response satisfies EndpointMetadataResponse, {
    headers: NO_STORE_HEADERS,
  })
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]">
) {
  const { endpointId: rawEndpointId } = await context.params
  const endpointId = parseEndpointId(rawEndpointId)

  if (!endpointId) {
    return createInvalidEndpointResponse()
  }

  let body: unknown

  try {
    body = JSON.parse(
      await readBoundedTextBody(request, MAX_ENDPOINT_METADATA_REQUEST_BYTES)
    ) as unknown
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json(
        {
          ok: false,
          error: "Request body too large.",
          maxBodyBytes: MAX_ENDPOINT_METADATA_REQUEST_BYTES,
        },
        { headers: NO_STORE_HEADERS, status: 413 }
      )
    }

    return Response.json(
      {
        ok: false,
        error: "Request body must be valid JSON.",
      },
      { headers: NO_STORE_HEADERS, status: 400 }
    )
  }

  const parsed = parseUpdateEndpointMetadataRequest(body)

  if (parsed.kind === "invalid") {
    return Response.json(
      {
        ok: false,
        error: parsed.error,
      },
      { headers: NO_STORE_HEADERS, status: 400 }
    )
  }

  let response: Awaited<ReturnType<typeof updateEndpointName>>

  try {
    response = await updateEndpointName({
      endpointId,
      name: parsed.name,
    })
  } catch (error) {
    if (isEndpointUnavailableError(error)) {
      return createEndpointNotFoundResponse()
    }

    throw error
  }

  return Response.json(response satisfies EndpointMetadataResponse, {
    headers: NO_STORE_HEADERS,
  })
}

function parseUpdateEndpointMetadataRequest(value: unknown):
  | {
      kind: "valid"
      name: string | null
    }
  | {
      kind: "invalid"
      error: string
    } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      kind: "invalid",
      error: "Endpoint metadata is required.",
    }
  }

  const name = (value as Partial<UpdateEndpointMetadataRequest>).name

  if (name === null) {
    return { kind: "valid", name: null }
  }

  if (typeof name !== "string") {
    return {
      kind: "invalid",
      error: "Endpoint name must be a string or null.",
    }
  }

  const trimmedName = name.trim()

  if (!trimmedName) {
    return { kind: "valid", name: null }
  }

  if (trimmedName.length > MAX_ENDPOINT_NAME_LENGTH) {
    return {
      kind: "invalid",
      error: `Endpoint name must be ${MAX_ENDPOINT_NAME_LENGTH} characters or fewer.`,
    }
  }

  return { kind: "valid", name: trimmedName }
}
