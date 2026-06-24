import {
  getEndpointAccessActor,
  requireEndpointUserId,
} from "@/lib/auth/endpoint-access"
import { AuthenticationRequiredError } from "@/lib/auth/session"
import { getAnonymousEndpointSessionId } from "@/lib/endpoint-session-cookie"
import type { EndpointAccountResponse } from "@webhooks-lol/webhooks-core/api-contracts"
import { parseEndpointId } from "@webhooks-lol/webhooks-core/endpoint-id"
import {
  createEndpointNotFoundResponse,
  createInvalidEndpointResponse,
} from "@webhooks-lol/webhooks-server/endpoint-route-responses"
import { publishEndpointAccessRevoked } from "@webhooks-lol/webhooks-server/endpoint-event-stream"
import { NO_STORE_HEADERS } from "@webhooks-lol/webhooks-server/http/headers"
import {
  getEndpointAccountStatus,
  isEndpointUnavailableError,
  saveEndpointToAccount,
} from "@webhooks-lol/webhooks-server/repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]/account">
) {
  const { endpointId: rawEndpointId } = await context.params
  const endpointId = parseEndpointId(rawEndpointId)

  if (!endpointId) {
    return createInvalidEndpointResponse()
  }

  try {
    const actor = await getEndpointAccessActor(request)
    const response = await getEndpointAccountStatus({
      anonymousSessionId: getAnonymousEndpointSessionId(request),
      endpointId,
      userId: actor.userId,
    })

    return Response.json(response satisfies EndpointAccountResponse, {
      headers: NO_STORE_HEADERS,
    })
  } catch (error) {
    if (isEndpointUnavailableError(error)) {
      return createEndpointNotFoundResponse()
    }

    throw error
  }
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]/account">
) {
  const { endpointId: rawEndpointId } = await context.params
  const endpointId = parseEndpointId(rawEndpointId)

  if (!endpointId) {
    return createInvalidEndpointResponse()
  }

  let ownerUserId: string

  try {
    ownerUserId = await requireEndpointUserId()
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json(
        { ok: false, error: "Authentication is required." },
        { headers: NO_STORE_HEADERS, status: 401 }
      )
    }

    throw error
  }

  const anonymousSessionId = getAnonymousEndpointSessionId(request)

  if (!anonymousSessionId) {
    return createEndpointNotFoundResponse()
  }

  try {
    const response = await saveEndpointToAccount({
      anonymousSessionId,
      endpointId,
      ownerUserId,
    })

    publishEndpointAccessRevoked(endpointId)

    return Response.json(response satisfies EndpointAccountResponse, {
      headers: NO_STORE_HEADERS,
    })
  } catch (error) {
    if (isEndpointUnavailableError(error)) {
      return createEndpointNotFoundResponse()
    }

    throw error
  }
}
