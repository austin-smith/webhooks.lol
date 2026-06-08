import "server-only"

import { and, desc, eq, lt, notInArray, or, sql } from "drizzle-orm"

import { getDatabase } from "@/lib/database/client"
import {
  capturedRequests,
  endpoints,
  endpointResponses,
} from "@/lib/database/schema"
import {
  DEFAULT_ENDPOINT_RESPONSE_CONFIG,
  type EndpointResponseConfig,
  type EndpointResponseOverrideInput,
} from "@/lib/webhooks/endpoint-response"
import type {
  CapturedRequest,
  CapturedRequestInput,
} from "@/lib/webhooks/types"

const MAX_REQUESTS_PER_ENDPOINT = 500
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
}

export type CreateEndpointOptions = {
  creatorKeyHash?: string | null
  now?: Date
}

export async function createEndpoint(options: CreateEndpointOptions = {}) {
  const endpointId = crypto.randomUUID()
  const now = options.now ?? new Date()
  await getDatabase()
    .insert(endpoints)
    .values({
      id: endpointId,
      creatorKeyHash: options.creatorKeyHash ?? null,
      createdAt: now,
      lastActivityAt: now,
    })

  return {
    endpointId,
    name: null,
  } satisfies EndpointMetadata
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
    .where(eq(capturedRequests.endpointId, endpoints.id))
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
    })

    const retainedRequestIds = transaction
      .select({ id: capturedRequests.id })
      .from(capturedRequests)
      .where(eq(capturedRequests.endpointId, request.endpointId))
      .orderBy(desc(capturedRequests.receivedAt), desc(capturedRequests.id))
      .limit(MAX_REQUESTS_PER_ENDPOINT)

    await transaction
      .delete(capturedRequests)
      .where(
        and(
          eq(capturedRequests.endpointId, request.endpointId),
          notInArray(capturedRequests.id, retainedRequestIds)
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

  const rows = await getDatabase()
    .select()
    .from(capturedRequests)
    .where(
      cursorFilter
        ? and(eq(capturedRequests.endpointId, endpointId), cursorFilter)
        : eq(capturedRequests.endpointId, endpointId)
    )
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

export async function clearRequests(endpointId: string) {
  const now = new Date()
  await assertEndpointExists(endpointId)

  await getDatabase().transaction(async (transaction) => {
    await transaction
      .delete(capturedRequests)
      .where(eq(capturedRequests.endpointId, endpointId))
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

function mapCapturedRequestRow(row: typeof capturedRequests.$inferSelect) {
  return {
    id: row.id,
    endpointId: row.endpointId,
    method: row.method,
    url: row.url,
    path: row.path,
    query: row.query,
    headers: row.headers,
    bodyText: row.bodyText,
    bodyBase64: row.bodyBase64,
    bodySize: row.bodySize,
    contentType: row.contentType,
    receivedAt: row.receivedAt.toISOString(),
    ip: row.ip,
  } satisfies CapturedRequest
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
) {
  if (!row) {
    throw new EndpointNotFoundError(endpointId)
  }
}

function normalizeRequestPageLimit(limit = DEFAULT_REQUEST_PAGE_SIZE) {
  if (!Number.isInteger(limit)) {
    return DEFAULT_REQUEST_PAGE_SIZE
  }

  return Math.min(Math.max(limit, 1), MAX_REQUEST_PAGE_SIZE)
}
