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
  isRequestSearchField,
  parseAdvancedRequestSearchQuery,
  parseRequestSearchCriteria,
  type RequestSearchConditionInput,
} from "@/lib/webhooks/request-search"
import {
  createEndpointNotFoundResponse,
  createInvalidEndpointResponse,
} from "@/lib/webhooks/endpoint-route-responses"
import { isUuid } from "@/lib/webhooks/id-format"

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
  const search = readRequestSearch(url.searchParams)

  if (cursor.kind === "invalid") {
    return Response.json(
      {
        ok: false,
        error: "Invalid request page cursor.",
      },
      { headers: NO_STORE_HEADERS, status: 400 }
    )
  }

  if (search.kind === "invalid") {
    return Response.json(
      {
        ok: false,
        error: search.error,
      },
      { headers: NO_STORE_HEADERS, status: 400 }
    )
  }

  let page: Awaited<ReturnType<typeof listRequests>>

  try {
    page = await listRequests(endpointId, {
      cursor: cursor.value,
      limit: readRequestPageLimit(url.searchParams),
      search: search.value,
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

function readRequestSearch(searchParams: URLSearchParams) {
  if (searchParams.has("searchField") || searchParams.has("searchValue")) {
    return {
      kind: "invalid",
      error: "Use field-specific request search parameters.",
    } as const
  }

  const advancedSearchValues = searchParams.getAll("search")

  if (advancedSearchValues.length > 1) {
    return {
      kind: "invalid",
      error: "Use one advanced request search parameter.",
    } as const
  }

  if (advancedSearchValues.length === 1) {
    const basicSearchFields = [...searchParams].filter(([field]) =>
      isBasicRequestSearchParameter(field)
    )

    if (basicSearchFields.length > 0) {
      return {
        kind: "invalid",
        error: "Use either basic or advanced request search parameters.",
      } as const
    }

    if (!advancedSearchValues[0]?.trim()) {
      return {
        kind: "invalid",
        error: "Advanced request search cannot be empty.",
      } as const
    }

    return parseAdvancedRequestSearchQuery(advancedSearchValues[0])
  }

  const conditions: RequestSearchConditionInput[] = []

  for (const [field, value] of searchParams) {
    if (!isRequestSearchField(field)) {
      continue
    }

    if (!value.trim()) {
      return {
        kind: "invalid",
        error: "Request search values cannot be empty.",
      } as const
    }

    conditions.push({ field, value })
  }

  return parseRequestSearchCriteria({
    methods: searchParams.getAll("method"),
    conditions,
  })
}

function isBasicRequestSearchParameter(field: string) {
  return field === "method" || isRequestSearchField(field)
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
