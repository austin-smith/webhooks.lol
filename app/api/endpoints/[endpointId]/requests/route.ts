import { NO_STORE_HEADERS } from "@/lib/http/headers"
import type { RequestsResponse } from "@/lib/webhooks/api-contracts"
import { parseEndpointId } from "@/lib/webhooks/endpoint-id"
import { publishEndpointCleared } from "@/lib/webhooks/endpoint-event-stream"
import {
  clearRequests,
  isEndpointUnavailableError,
  listRequests,
  type RequestPageCursor,
} from "@/lib/webhooks/repository"
import {
  createEndpointNotFoundResponse,
  createInvalidEndpointResponse,
} from "@/lib/webhooks/endpoint-route-responses"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]/requests">
) {
  const { endpointId: rawEndpointId } = await context.params
  const endpointId = parseEndpointId(rawEndpointId)

  if (!endpointId) {
    return createInvalidEndpointResponse()
  }

  const url = new URL(request.url)
  const cursor = readRequestPageCursor(url.searchParams)

  if (cursor.kind === "invalid") {
    return Response.json(
      {
        ok: false,
        error: "Invalid request page cursor.",
      },
      { headers: NO_STORE_HEADERS, status: 400 }
    )
  }

  let page: Awaited<ReturnType<typeof listRequests>>

  try {
    page = await listRequests(endpointId, {
      cursor: cursor.value,
      limit: readRequestPageLimit(url.searchParams),
    })
  } catch (error) {
    if (isEndpointUnavailableError(error)) {
      return createEndpointNotFoundResponse()
    }

    throw error
  }
  const response = {
    endpointId,
    page: {
      hasMore: page.hasMore,
      nextCursor: page.nextCursor
        ? encodeRequestPageCursor(page.nextCursor)
        : null,
    },
    requests: page.requests,
  } satisfies RequestsResponse

  return Response.json(response, { headers: NO_STORE_HEADERS })
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/endpoints/[endpointId]/requests">
) {
  const { endpointId: rawEndpointId } = await context.params
  const endpointId = parseEndpointId(rawEndpointId)

  if (!endpointId) {
    return createInvalidEndpointResponse()
  }

  try {
    await clearRequests(endpointId)
  } catch (error) {
    if (isEndpointUnavailableError(error)) {
      return createEndpointNotFoundResponse()
    }

    throw error
  }

  publishEndpointCleared(endpointId)
  const response = {
    endpointId,
    page: {
      hasMore: false,
      nextCursor: null,
    },
    requests: [],
  } satisfies RequestsResponse

  return Response.json(response, { headers: NO_STORE_HEADERS })
}

function readRequestPageLimit(searchParams: URLSearchParams) {
  const rawLimit = searchParams.get("limit")

  if (!rawLimit) {
    return undefined
  }

  return Number(rawLimit)
}

function readRequestPageCursor(searchParams: URLSearchParams):
  | {
      kind: "valid"
      value: RequestPageCursor | undefined
    }
  | {
      kind: "invalid"
    } {
  const cursor = searchParams.get("cursor")

  if (!cursor) {
    return { kind: "valid", value: undefined }
  }

  const [receivedAt, id, ...extraParts] = cursor.split("|")
  const receivedAtDate = new Date(receivedAt ?? "")

  if (
    extraParts.length > 0 ||
    !receivedAt ||
    !id ||
    !isUuid(id) ||
    Number.isNaN(receivedAtDate.getTime())
  ) {
    return { kind: "invalid" }
  }

  return {
    kind: "valid",
    value: {
      id,
      receivedAt: receivedAtDate,
    },
  }
}

function encodeRequestPageCursor(cursor: RequestPageCursor) {
  return `${cursor.receivedAt.toISOString()}|${cursor.id}`
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}
