import { NO_STORE_HEADERS } from "@webhooks-lol/webhooks-server/http/headers"
import {
  readBoundedTextBody,
  RequestBodyTooLargeError,
} from "@webhooks-lol/webhooks-server/http/request-body"
import type { EndpointResponseConfigResponse } from "@webhooks-lol/webhooks-core/api-contracts"
import { parseEndpointId } from "@webhooks-lol/webhooks-core/endpoint-id"
import {
  EndpointResponseValidationError,
  MAX_RESPONSE_OVERRIDE_REQUEST_BYTES,
  parseEndpointResponseOverrideInput,
} from "@webhooks-lol/webhooks-core/endpoint-response"
import {
  clearEndpointResponseOverride,
  getEndpointResponseConfig,
  isEndpointUnavailableError,
  setEndpointResponseOverride,
} from "@webhooks-lol/webhooks-server/repository"
import {
  createEndpointNotFoundResponse,
  createInvalidEndpointResponse,
} from "@webhooks-lol/webhooks-server/endpoint-route-responses"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]/response">
) {
  const { endpointId: rawEndpointId } = await context.params
  const endpointId = parseEndpointId(rawEndpointId)

  if (!endpointId) {
    return createInvalidEndpointResponse()
  }

  let response: EndpointResponseConfigResponse

  try {
    response = {
      endpointId,
      response: await getEndpointResponseConfig(endpointId),
    } satisfies EndpointResponseConfigResponse
  } catch (error) {
    if (isEndpointUnavailableError(error)) {
      return createEndpointNotFoundResponse()
    }

    throw error
  }

  return Response.json(response, { headers: NO_STORE_HEADERS })
}

export async function PUT(
  request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]/response">
) {
  const { endpointId: rawEndpointId } = await context.params
  const endpointId = parseEndpointId(rawEndpointId)

  if (!endpointId) {
    return createInvalidEndpointResponse()
  }

  let body: unknown

  try {
    body = JSON.parse(
      await readBoundedTextBody(request, MAX_RESPONSE_OVERRIDE_REQUEST_BYTES)
    )
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json(
        {
          ok: false,
          error: "Request body too large.",
          maxBodyBytes: MAX_RESPONSE_OVERRIDE_REQUEST_BYTES,
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

  try {
    const override = parseEndpointResponseOverrideInput(body)
    const response = {
      endpointId,
      response: await setEndpointResponseOverride({
        endpointId,
        override,
      }),
    } satisfies EndpointResponseConfigResponse

    return Response.json(response, { headers: NO_STORE_HEADERS })
  } catch (error) {
    if (isEndpointUnavailableError(error)) {
      return createEndpointNotFoundResponse()
    }

    if (error instanceof EndpointResponseValidationError) {
      return Response.json(
        {
          ok: false,
          error: error.message,
          issues: error.issues,
        },
        { headers: NO_STORE_HEADERS, status: 400 }
      )
    }

    throw error
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]/response">
) {
  const { endpointId: rawEndpointId } = await context.params
  const endpointId = parseEndpointId(rawEndpointId)

  if (!endpointId) {
    return createInvalidEndpointResponse()
  }

  let response: EndpointResponseConfigResponse

  try {
    response = {
      endpointId,
      response: await clearEndpointResponseOverride(endpointId),
    } satisfies EndpointResponseConfigResponse
  } catch (error) {
    if (isEndpointUnavailableError(error)) {
      return createEndpointNotFoundResponse()
    }

    throw error
  }

  return Response.json(response, { headers: NO_STORE_HEADERS })
}
