import "server-only"

import {
  and,
  desc,
  eq,
  inArray,
  lt,
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
  ownerUserId?: string | null
}

export async function createEndpoint(options: CreateEndpointOptions = {}) {
  const endpointId = crypto.randomUUID()
  const now = options.now ?? new Date()
  await getDatabase()
    .insert(endpoints)
    .values({
      id: endpointId,
      creatorKeyHash: options.creatorKeyHash ?? null,
      ownerUserId: options.ownerUserId ?? null,
      createdAt: now,
      lastActivityAt: now,
    })

  return {
    endpointId,
    name: null,
  } satisfies EndpointMetadata
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
