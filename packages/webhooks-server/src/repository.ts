import "server-only"

import {
  and,
  desc,
  eq,
  inArray,
  lt,
  max,
  ne,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm"

import { getDatabase } from "@webhooks-lol/database/client"
import {
  capturedRequests,
  endpointForwardDeliveries,
  endpoints,
  endpointResponses,
  user as authUsers,
} from "@webhooks-lol/database/schema"
import { mapCapturedRequestRow } from "@webhooks-lol/webhooks-server/captured-request-row"
import { enqueueEndpointForwardDeliveriesForRequest } from "@webhooks-lol/webhooks-server/endpoint-forwarding/repository"
import {
  DEFAULT_ENDPOINT_RESPONSE_CONFIG,
  type EndpointResponseConfig,
  type EndpointResponseOverrideInput,
} from "@webhooks-lol/webhooks-core/endpoint-response"
import type {
  CapturedRequest,
  CapturedRequestInput,
} from "@webhooks-lol/webhooks-core/types"
import {
  requestSearchIsActive,
  type AdvancedRequestSearchExpression,
  type AdvancedRequestSearchScalarField,
  type RequestSearchCriteria,
  type RequestSearchField,
} from "@webhooks-lol/webhooks-core/request-search"
import { MAX_ENDPOINTS_PER_IDENTITY } from "@webhooks-lol/webhooks-server/policies"
import { MAX_REQUESTS_PER_ENDPOINT } from "@webhooks-lol/webhooks-server/request-retention"

export const MAX_ENDPOINT_NAME_LENGTH = 32
export const DEFAULT_REQUEST_PAGE_SIZE = 50
export const MAX_REQUEST_PAGE_SIZE = 100

export class EndpointNotFoundError extends Error {
  constructor(endpointId: string) {
    super(`Endpoint ${endpointId} was not found.`)
    this.name = "EndpointNotFoundError"
  }
}

export type EndpointMetadata = {
  endpointId: string
  name: string | null
}

export type EndpointAccountStatus = {
  canSaveToAccount: boolean
  endpointId: string
  savedToAccount: boolean
}

export type EndpointAccessActor = {
  userId: string | null
}

export type EndpointStats = {
  endpointId: string
  requestCount: number
  bodySizeBytes: number
  createdAt: string
  lastActivityAt: string
}

export type AccountWebhookStats = {
  endpointCount: number
  requestCount: number
  lastActivityAt: string | null
}

export type RequestPageCursor = {
  id: string
  receivedAt: Date
}

export type RequestPageOptions = {
  cursor?: RequestPageCursor
  limit?: number
  search?: RequestSearchCriteria
}

export type CreateEndpointOptions = {
  creatorKeyHash?: string | null
  now?: Date
} & (
  | {
      anonymousSessionId: string
      ownerUserId?: null
    }
  | {
      anonymousSessionId?: null
      ownerUserId: string
    }
)

type EndpointIdentity = {
  anonymousSessionId?: string | null
  ownerUserId?: string | null
}

export async function createEndpoint(options: CreateEndpointOptions) {
  const endpointId = crypto.randomUUID()
  const now = options.now ?? new Date()
  const anonymousSessionId = options.anonymousSessionId ?? null
  const ownerUserId = options.ownerUserId ?? null

  assertEndpointHasSingleIdentity({ anonymousSessionId, ownerUserId })

  await getDatabase().transaction(async (transaction) => {
    await lockEndpointIdentityForCreate({
      anonymousSessionId,
      ownerUserId,
      transaction,
    })

    await transaction.insert(endpoints).values({
      id: endpointId,
      anonymousSessionId,
      creatorKeyHash: options.creatorKeyHash ?? null,
      ownerUserId,
      createdAt: now,
      lastActivityAt: now,
    })

    await trimEndpointIdentity({
      anonymousSessionId,
      endpointId,
      ownerUserId,
      transaction,
    })
  })

  return {
    endpointId,
    name: null,
  } satisfies EndpointMetadata
}

function assertEndpointHasSingleIdentity({
  anonymousSessionId,
  ownerUserId,
}: EndpointIdentity) {
  if (Boolean(ownerUserId) === Boolean(anonymousSessionId)) {
    throw new Error(
      "Endpoint must have exactly one owner identity: user or anonymous session."
    )
  }
}

export async function listEndpointsForUser(userId: string) {
  const rows = await getDatabase()
    .select({
      id: endpoints.id,
      name: endpoints.name,
    })
    .from(endpoints)
    .where(eq(endpoints.ownerUserId, userId))
    .orderBy(desc(endpoints.lastActivityAt), desc(endpoints.id))

  return rows.map(mapEndpointRow)
}

export async function getAccountWebhookStats(
  userId: string
): Promise<AccountWebhookStats> {
  const db = getDatabase()

  const [endpointStats, requestStats] = await Promise.all([
    db
      .select({
        endpointCount: sql<number>`cast(count(*) as integer)`.as(
          "endpoint_count"
        ),
      })
      .from(endpoints)
      .where(eq(endpoints.ownerUserId, userId)),
    db
      .select({
        requestCount: sql<number>`cast(count(*) as integer)`.as(
          "request_count"
        ),
        lastRequestAt: max(capturedRequests.receivedAt).as("last_request_at"),
      })
      .from(capturedRequests)
      .innerJoin(endpoints, eq(capturedRequests.endpointId, endpoints.id))
      .where(
        and(
          eq(endpoints.ownerUserId, userId),
          eq(capturedRequests.deleteAfterForwarding, false)
        )
      ),
  ])

  return {
    endpointCount: Number(endpointStats[0]?.endpointCount ?? 0),
    requestCount: Number(requestStats[0]?.requestCount ?? 0),
    lastActivityAt: requestStats[0]?.lastRequestAt?.toISOString() ?? null,
  }
}

type WebhookDatabase = ReturnType<typeof getDatabase>
type WebhookDatabaseTransaction = Parameters<
  Parameters<WebhookDatabase["transaction"]>[0]
>[0]

async function lockEndpointIdentityForCreate({
  anonymousSessionId,
  ownerUserId,
  transaction,
}: {
  anonymousSessionId: string | null
  ownerUserId: string | null
  transaction: WebhookDatabaseTransaction
}) {
  if (ownerUserId) {
    await transaction.execute(
      sql`select 1 from ${authUsers} where ${authUsers.id} = ${ownerUserId} for update`
    )
    return
  }

  if (anonymousSessionId) {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(1869563150, hashtext(${anonymousSessionId}))`
    )
  }
}

async function trimEndpointIdentity({
  anonymousSessionId,
  endpointId,
  ownerUserId,
  transaction,
}: {
  anonymousSessionId: string | null
  endpointId: string
  ownerUserId: string | null
  transaction: WebhookDatabaseTransaction
}) {
  if (ownerUserId) {
    const retainedEndpointIds = transaction
      .select({ id: endpoints.id })
      .from(endpoints)
      .where(
        and(
          eq(endpoints.ownerUserId, ownerUserId),
          ne(endpoints.id, endpointId)
        )
      )
      .orderBy(desc(endpoints.lastActivityAt), desc(endpoints.id))
      .limit(MAX_ENDPOINTS_PER_IDENTITY - 1)

    await transaction
      .delete(endpoints)
      .where(
        and(
          eq(endpoints.ownerUserId, ownerUserId),
          ne(endpoints.id, endpointId),
          notInArray(endpoints.id, retainedEndpointIds)
        )
      )
    return
  }

  if (anonymousSessionId) {
    const retainedEndpointIds = transaction
      .select({ id: endpoints.id })
      .from(endpoints)
      .where(
        and(
          eq(endpoints.anonymousSessionId, anonymousSessionId),
          ne(endpoints.id, endpointId)
        )
      )
      .orderBy(desc(endpoints.lastActivityAt), desc(endpoints.id))
      .limit(MAX_ENDPOINTS_PER_IDENTITY - 1)

    await transaction
      .delete(endpoints)
      .where(
        and(
          eq(endpoints.anonymousSessionId, anonymousSessionId),
          ne(endpoints.id, endpointId),
          notInArray(endpoints.id, retainedEndpointIds)
        )
      )
  }
}

export async function getEndpoint(endpointId: string) {
  const [row] = await getDatabase()
    .select({
      id: endpoints.id,
      name: endpoints.name,
    })
    .from(endpoints)
    .where(eq(endpoints.id, endpointId))
    .limit(1)

  assertEndpointRowIsActive(endpointId, row)

  return mapEndpointRow(row)
}

export async function getEndpointForActor(
  endpointId: string,
  actor: EndpointAccessActor
) {
  const [row] = await getDatabase()
    .select({
      id: endpoints.id,
      name: endpoints.name,
      ownerUserId: endpoints.ownerUserId,
    })
    .from(endpoints)
    .where(eq(endpoints.id, endpointId))
    .limit(1)

  assertEndpointRowIsVisibleToActor(endpointId, row, actor)

  return mapEndpointRow(row)
}

export async function assertEndpointAccessibleToActor(
  endpointId: string,
  actor: EndpointAccessActor
) {
  const [row] = await getDatabase()
    .select({
      id: endpoints.id,
      ownerUserId: endpoints.ownerUserId,
    })
    .from(endpoints)
    .where(eq(endpoints.id, endpointId))
    .limit(1)

  assertEndpointRowIsVisibleToActor(endpointId, row, actor)
}

export async function getEndpointAccountStatus({
  anonymousSessionId,
  endpointId,
  userId,
}: {
  anonymousSessionId: string | null
  endpointId: string
  userId: string | null
}) {
  const [row] = await getDatabase()
    .select({
      id: endpoints.id,
      anonymousSessionId: endpoints.anonymousSessionId,
      ownerUserId: endpoints.ownerUserId,
    })
    .from(endpoints)
    .where(eq(endpoints.id, endpointId))
    .limit(1)

  assertEndpointRowIsVisibleToActor(endpointId, row, { userId })

  return mapEndpointAccountStatus(row, anonymousSessionId)
}

export async function saveEndpointToAccount({
  anonymousSessionId,
  endpointId,
  ownerUserId,
}: {
  anonymousSessionId: string
  endpointId: string
  ownerUserId: string
}) {
  const now = new Date()

  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(
      sql`select 1 from ${authUsers} where ${authUsers.id} = ${ownerUserId} for update`
    )
    await transaction.execute(
      sql`select pg_advisory_xact_lock(1869563150, hashtext(${anonymousSessionId}))`
    )

    const [row] = await transaction
      .select({
        id: endpoints.id,
        anonymousSessionId: endpoints.anonymousSessionId,
        ownerUserId: endpoints.ownerUserId,
      })
      .from(endpoints)
      .where(eq(endpoints.id, endpointId))
      .limit(1)

    assertEndpointRowIsActive(endpointId, row)

    if (row.ownerUserId === ownerUserId) {
      return mapEndpointAccountStatus(row, anonymousSessionId)
    }

    if (row.ownerUserId || row.anonymousSessionId !== anonymousSessionId) {
      throw new EndpointNotFoundError(endpointId)
    }

    const [savedRow] = await transaction
      .update(endpoints)
      .set({
        anonymousSessionId: null,
        lastActivityAt: now,
        ownerUserId,
      })
      .where(
        and(
          eq(endpoints.id, endpointId),
          eq(endpoints.anonymousSessionId, anonymousSessionId)
        )
      )
      .returning({
        id: endpoints.id,
        anonymousSessionId: endpoints.anonymousSessionId,
        ownerUserId: endpoints.ownerUserId,
      })

    assertEndpointRowIsActive(endpointId, savedRow)

    await trimEndpointIdentity({
      anonymousSessionId: null,
      endpointId,
      ownerUserId,
      transaction,
    })

    return mapEndpointAccountStatus(savedRow, anonymousSessionId)
  })
}

export async function getEndpointStats(endpointId: string) {
  const db = getDatabase()
  const requestStats = db
    .select({
      requestCount: sql<number>`cast(count(*) as integer)`.as("request_count"),
      bodySizeBytes:
        sql<number>`cast(coalesce(sum(${capturedRequests.bodySize}), 0) as integer)`.as(
          "body_size_bytes"
        ),
    })
    .from(capturedRequests)
    .where(
      and(
        eq(capturedRequests.endpointId, endpoints.id),
        eq(capturedRequests.deleteAfterForwarding, false)
      )
    )
    .as("request_stats")

  const [row] = await db
    .select({
      id: endpoints.id,
      createdAt: endpoints.createdAt,
      lastActivityAt: endpoints.lastActivityAt,
      requestCount: requestStats.requestCount,
      bodySizeBytes: requestStats.bodySizeBytes,
    })
    .from(endpoints)
    .leftJoinLateral(requestStats, sql`true`)
    .where(eq(endpoints.id, endpointId))
    .limit(1)

  assertEndpointRowIsActive(endpointId, row)

  return mapEndpointStatsRow(row)
}

export async function updateEndpointName({
  endpointId,
  name,
}: {
  endpointId: string
  name: string | null
}) {
  const now = new Date()
  await assertEndpointExists(endpointId)
  const [row] = await getDatabase()
    .update(endpoints)
    .set({
      name,
      lastActivityAt: now,
    })
    .where(eq(endpoints.id, endpointId))
    .returning({
      id: endpoints.id,
      name: endpoints.name,
    })

  if (!row) {
    throw new EndpointNotFoundError(endpointId)
  }

  return mapEndpointRow(row)
}

export async function saveCapturedRequest(input: CapturedRequestInput) {
  const receivedAt = new Date()
  const request: CapturedRequest = {
    ...input,
    id: crypto.randomUUID(),
    receivedAt: receivedAt.toISOString(),
  }

  const db = getDatabase()

  await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select 1 from ${endpoints} where ${endpoints.id} = ${request.endpointId} for update`
    )
    const [endpoint] = await transaction
      .select({ id: endpoints.id })
      .from(endpoints)
      .where(eq(endpoints.id, request.endpointId))
      .limit(1)

    assertEndpointRowIsActive(request.endpointId, endpoint)

    await transaction.insert(capturedRequests).values({
      id: request.id,
      endpointId: request.endpointId,
      method: request.method,
      url: request.url,
      path: request.path,
      query: request.query,
      headers: request.headers,
      bodyText: request.bodyText,
      bodyBase64: request.bodyBase64,
      bodySize: request.bodySize,
      contentType: request.contentType,
      receivedAt,
      ip: request.ip,
      deleteAfterForwarding: false,
    })

    await enqueueEndpointForwardDeliveriesForRequest({
      request,
      transaction,
    })

    const retainedRequestIds = transaction
      .select({ id: capturedRequests.id })
      .from(capturedRequests)
      .where(
        and(
          eq(capturedRequests.endpointId, request.endpointId),
          eq(capturedRequests.deleteAfterForwarding, false)
        )
      )
      .orderBy(desc(capturedRequests.receivedAt), desc(capturedRequests.id))
      .limit(MAX_REQUESTS_PER_ENDPOINT)
    const activeForwardingRequestIds = transaction
      .select({ id: endpointForwardDeliveries.requestId })
      .from(endpointForwardDeliveries)
      .where(
        and(
          eq(endpointForwardDeliveries.endpointId, request.endpointId),
          eq(endpointForwardDeliveries.status, "pending")
        )
      )

    await transaction
      .delete(capturedRequests)
      .where(
        and(
          eq(capturedRequests.endpointId, request.endpointId),
          notInArray(capturedRequests.id, retainedRequestIds),
          notInArray(capturedRequests.id, activeForwardingRequestIds)
        )
      )

    await transaction
      .update(endpoints)
      .set({
        lastActivityAt: receivedAt,
      })
      .where(eq(endpoints.id, request.endpointId))
  })

  return request
}

export async function listRequests(
  endpointId: string,
  options: RequestPageOptions = {}
) {
  await assertEndpointExists(endpointId)

  const limit = normalizeRequestPageLimit(options.limit)
  const rowsLimit = limit + 1
  const cursorFilter = options.cursor
    ? or(
        lt(capturedRequests.receivedAt, options.cursor.receivedAt),
        and(
          eq(capturedRequests.receivedAt, options.cursor.receivedAt),
          lt(capturedRequests.id, options.cursor.id)
        )
      )
    : undefined
  const searchFilter = createRequestSearchFilter(options.search)
  const filters = [
    eq(capturedRequests.endpointId, endpointId),
    eq(capturedRequests.deleteAfterForwarding, false),
    cursorFilter,
    searchFilter,
  ].filter((filter): filter is SQL => Boolean(filter))

  const rows = await getDatabase()
    .select()
    .from(capturedRequests)
    .where(and(...filters))
    .orderBy(desc(capturedRequests.receivedAt), desc(capturedRequests.id))
    .limit(rowsLimit)

  const pageRows = rows.slice(0, limit)
  const lastRow = pageRows.at(-1) ?? null

  return {
    hasMore: rows.length > limit,
    nextCursor:
      rows.length > limit && lastRow
        ? {
            id: lastRow.id,
            receivedAt: lastRow.receivedAt,
          }
        : null,
    requests: pageRows.map(mapCapturedRequestRow),
  }
}

export async function getRequest(endpointId: string, requestId: string) {
  await assertEndpointExists(endpointId)

  const [row] = await getDatabase()
    .select()
    .from(capturedRequests)
    .where(
      and(
        eq(capturedRequests.endpointId, endpointId),
        eq(capturedRequests.id, requestId),
        eq(capturedRequests.deleteAfterForwarding, false)
      )
    )
    .limit(1)

  return row ? mapCapturedRequestRow(row) : null
}

export async function clearRequests(endpointId: string) {
  const now = new Date()
  await assertEndpointExists(endpointId)

  await getDatabase().transaction(async (transaction) => {
    const activeForwardingRequestIds = transaction
      .select({ id: endpointForwardDeliveries.requestId })
      .from(endpointForwardDeliveries)
      .where(
        and(
          eq(endpointForwardDeliveries.endpointId, endpointId),
          eq(endpointForwardDeliveries.status, "pending")
        )
      )

    await transaction
      .update(capturedRequests)
      .set({ deleteAfterForwarding: true })
      .where(
        and(
          eq(capturedRequests.endpointId, endpointId),
          inArray(capturedRequests.id, activeForwardingRequestIds)
        )
      )

    await transaction
      .delete(capturedRequests)
      .where(
        and(
          eq(capturedRequests.endpointId, endpointId),
          notInArray(capturedRequests.id, activeForwardingRequestIds)
        )
      )
    await transaction
      .update(endpoints)
      .set({
        lastActivityAt: now,
      })
      .where(eq(endpoints.id, endpointId))
  })
}

export async function getEndpointResponseConfig(
  endpointId: string
): Promise<EndpointResponseConfig> {
  await assertEndpointExists(endpointId)

  const rows = await getDatabase()
    .select()
    .from(endpointResponses)
    .where(eq(endpointResponses.endpointId, endpointId))
    .limit(1)

  const configuredResponse = rows[0]

  if (!configuredResponse) {
    return DEFAULT_ENDPOINT_RESPONSE_CONFIG
  }

  return mapEndpointResponseRow(configuredResponse)
}

export async function setEndpointResponseOverride({
  endpointId,
  override,
}: {
  endpointId: string
  override: EndpointResponseOverrideInput
}) {
  const now = new Date()
  await assertEndpointExists(endpointId)

  await getDatabase().transaction(async (transaction) => {
    await transaction
      .insert(endpointResponses)
      .values({
        endpointId,
        status: override.status,
        contentType: override.contentType,
        body: override.body,
      })
      .onConflictDoUpdate({
        target: endpointResponses.endpointId,
        set: {
          status: override.status,
          contentType: override.contentType,
          body: override.body,
          updatedAt: now,
        },
      })

    await transaction
      .update(endpoints)
      .set({
        lastActivityAt: now,
      })
      .where(eq(endpoints.id, endpointId))
  })

  return {
    mode: "custom",
    ...override,
  } satisfies EndpointResponseConfig
}

export async function clearEndpointResponseOverride(endpointId: string) {
  const now = new Date()
  await assertEndpointExists(endpointId)

  await getDatabase().transaction(async (transaction) => {
    await transaction
      .delete(endpointResponses)
      .where(eq(endpointResponses.endpointId, endpointId))
    await transaction
      .update(endpoints)
      .set({
        lastActivityAt: now,
      })
      .where(eq(endpoints.id, endpointId))
  })

  return DEFAULT_ENDPOINT_RESPONSE_CONFIG
}

function mapEndpointRow(row: { id: string; name: string | null }) {
  return {
    endpointId: row.id,
    name: row.name,
  } satisfies EndpointMetadata
}

function mapEndpointAccountStatus(
  row: {
    id: string
    anonymousSessionId?: string | null
    ownerUserId?: string | null
  },
  anonymousSessionId: string | null
) {
  return {
    canSaveToAccount: Boolean(
      row.anonymousSessionId && row.anonymousSessionId === anonymousSessionId
    ),
    endpointId: row.id,
    savedToAccount: Boolean(row.ownerUserId),
  } satisfies EndpointAccountStatus
}

function mapEndpointStatsRow(row: {
  id: string
  requestCount: number
  bodySizeBytes: number
  createdAt: Date
  lastActivityAt: Date
}) {
  return {
    endpointId: row.id,
    requestCount: row.requestCount,
    bodySizeBytes: row.bodySizeBytes,
    createdAt: row.createdAt.toISOString(),
    lastActivityAt: row.lastActivityAt.toISOString(),
  } satisfies EndpointStats
}

function mapEndpointResponseRow(row: typeof endpointResponses.$inferSelect) {
  return {
    mode: "custom",
    status: row.status,
    contentType: row.contentType,
    body: row.body,
  } satisfies EndpointResponseConfig
}

export function isEndpointUnavailableError(error: unknown) {
  return error instanceof EndpointNotFoundError
}

async function assertEndpointExists(endpointId: string) {
  const [row] = await getDatabase()
    .select({ id: endpoints.id })
    .from(endpoints)
    .where(eq(endpoints.id, endpointId))
    .limit(1)

  assertEndpointRowIsActive(endpointId, row)
}

function assertEndpointRowIsActive(
  endpointId: string,
  row: { id?: string } | undefined
): asserts row is { id?: string } {
  if (!row) {
    throw new EndpointNotFoundError(endpointId)
  }
}

function assertEndpointRowIsVisibleToActor(
  endpointId: string,
  row: { id?: string; ownerUserId: string | null } | undefined,
  actor: EndpointAccessActor
) {
  assertEndpointRowIsActive(endpointId, row)

  if (row.ownerUserId && row.ownerUserId !== actor.userId) {
    throw new EndpointNotFoundError(endpointId)
  }
}

function normalizeRequestPageLimit(limit = DEFAULT_REQUEST_PAGE_SIZE) {
  if (!Number.isInteger(limit)) {
    return DEFAULT_REQUEST_PAGE_SIZE
  }

  return Math.min(Math.max(limit, 1), MAX_REQUEST_PAGE_SIZE)
}

function createRequestSearchFilter(search: RequestSearchCriteria | undefined) {
  if (!search || !requestSearchIsActive(search)) {
    return undefined
  }

  if (search.mode === "advanced") {
    return createAdvancedRequestSearchFilter(search.expression)
  }

  const filters: SQL[] = []

  if (search.methods.length > 0) {
    filters.push(inArray(capturedRequests.method, search.methods))
  }

  for (const condition of search.conditions) {
    filters.push(
      sql`lower(${createRequestSearchFieldExpression(condition.field)}) like ${createLikePattern(condition.value)} escape '\\'`
    )
  }

  return and(...filters)
}

function createAdvancedRequestSearchFilter(
  expression: AdvancedRequestSearchExpression
): SQL {
  switch (expression.kind) {
    case "and":
      return combineAdvancedSearchFilters(
        "AND",
        createAdvancedRequestSearchFilter(expression.left),
        createAdvancedRequestSearchFilter(expression.right)
      )
    case "not":
      return sql`not (${createAdvancedRequestSearchFilter(expression.expression)})`
    case "or":
      return combineAdvancedSearchFilters(
        "OR",
        createAdvancedRequestSearchFilter(expression.left),
        createAdvancedRequestSearchFilter(expression.right)
      )
    case "term":
      if (expression.field.kind === "scalar") {
        if (expression.field.name === "method") {
          return eq(capturedRequests.method, expression.value.toUpperCase())
        }

        const jsonbFilter = createAdvancedJsonbSearchFilter(
          expression.field.name,
          expression.value
        )

        if (jsonbFilter) {
          return jsonbFilter
        }

        return sql`lower(${createAdvancedRequestSearchScalarExpression(expression.field.name)}) like ${createLikePattern(expression.value)} escape '\\'`
      }

      if (expression.field.kind === "headers") {
        return sql`lower(coalesce(${capturedRequests.headers} ->> ${expression.field.key}, '')) like ${createLikePattern(expression.value)} escape '\\'`
      }

      return sql`exists (
        select 1
        from jsonb_array_elements_text(coalesce(${capturedRequests.query} -> ${expression.field.key}, '[]'::jsonb)) as query_value(value)
        where lower(query_value.value) like ${createLikePattern(expression.value)} escape '\\'
      )`
  }
}

function createAdvancedJsonbSearchFilter(
  field: AdvancedRequestSearchScalarField,
  value: string
) {
  switch (field) {
    case "headerName":
      return sql`exists (
        select 1
        from jsonb_object_keys(${capturedRequests.headers}) as header_key(value)
        where lower(header_key.value) like ${createLikePattern(value)} escape '\\'
      )`
    case "headerValue":
      return sql`exists (
        select 1
        from jsonb_each_text(${capturedRequests.headers}) as header_entry(key, value)
        where lower(header_entry.value) like ${createLikePattern(value)} escape '\\'
      )`
    case "queryName":
      return sql`exists (
        select 1
        from jsonb_object_keys(${capturedRequests.query}) as query_key(value)
        where lower(query_key.value) like ${createLikePattern(value)} escape '\\'
      )`
    case "queryValue":
      return sql`exists (
        select 1
        from jsonb_each(${capturedRequests.query}) as query_entry(key, values)
        cross join jsonb_array_elements_text(query_entry.values) as query_value(value)
        where lower(query_value.value) like ${createLikePattern(value)} escape '\\'
      )`
    default:
      return undefined
  }
}

function combineAdvancedSearchFilters(
  operator: "AND" | "OR",
  left: SQL,
  right: SQL
) {
  const combined = operator === "AND" ? and(left, right) : or(left, right)

  if (!combined) {
    throw new Error("Advanced request search produced an empty SQL predicate.")
  }

  return combined
}

function createAdvancedRequestSearchScalarExpression(
  field: AdvancedRequestSearchScalarField
) {
  switch (field) {
    case "body":
      return capturedRequests.bodyText
    case "contentType":
      return sql`coalesce(${capturedRequests.contentType}, '')`
    case "headers":
      return sql`${capturedRequests.headers}::text`
    case "headerName":
    case "headerValue":
      throw new Error("Advanced header key/value search must use JSONB SQL.")
    case "ip":
      return sql`coalesce(${capturedRequests.ip}, '')`
    case "method":
      return capturedRequests.method
    case "path":
      return capturedRequests.path
    case "query":
      return sql`${capturedRequests.query}::text`
    case "queryName":
    case "queryValue":
      throw new Error("Advanced query key/value search must use JSONB SQL.")
    case "url":
      return capturedRequests.url
  }
}

function createRequestSearchFieldExpression(field: RequestSearchField) {
  switch (field) {
    case "body":
      return capturedRequests.bodyText
    case "contentType":
      return sql`coalesce(${capturedRequests.contentType}, '')`
    case "headers":
      return sql`${capturedRequests.headers}::text`
    case "ip":
      return sql`coalesce(${capturedRequests.ip}, '')`
    case "path":
      return capturedRequests.path
    case "query":
      return sql`${capturedRequests.query}::text`
    case "url":
      return capturedRequests.url
  }
}

function createLikePattern(value: string) {
  return `%${value.toLowerCase().replace(/[\\%_]/g, (character) => `\\${character}`)}%`
}
