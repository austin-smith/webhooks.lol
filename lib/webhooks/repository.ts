import "server-only"

import { and, desc, eq, notInArray, sql } from "drizzle-orm"

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

export async function createEndpoint() {
  const endpointId = crypto.randomUUID()
  await ensureEndpoint(endpointId)
  return endpointId
}

export async function ensureEndpoint(endpointId: string) {
  await getDatabase()
    .insert(endpoints)
    .values({
      id: endpointId,
      createdAt: new Date(),
    })
    .onConflictDoNothing({ target: endpoints.id })
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
    await transaction
      .insert(endpoints)
      .values({
        id: request.endpointId,
        createdAt: new Date(),
      })
      .onConflictDoNothing({ target: endpoints.id })

    await transaction.execute(
      sql`select 1 from ${endpoints} where ${endpoints.id} = ${request.endpointId} for update`
    )

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
      .orderBy(desc(capturedRequests.receivedAt))
      .limit(MAX_REQUESTS_PER_ENDPOINT)

    await transaction
      .delete(capturedRequests)
      .where(
        and(
          eq(capturedRequests.endpointId, request.endpointId),
          notInArray(capturedRequests.id, retainedRequestIds)
        )
      )
  })

  return request
}

export async function listRequests(endpointId: string) {
  await ensureEndpoint(endpointId)

  const rows = await getDatabase()
    .select()
    .from(capturedRequests)
    .where(eq(capturedRequests.endpointId, endpointId))
    .orderBy(desc(capturedRequests.receivedAt))
    .limit(MAX_REQUESTS_PER_ENDPOINT)

  return rows.map(mapCapturedRequestRow)
}

export async function clearRequests(endpointId: string) {
  await ensureEndpoint(endpointId)

  await getDatabase()
    .delete(capturedRequests)
    .where(eq(capturedRequests.endpointId, endpointId))
}

export async function getEndpointResponseConfig(
  endpointId: string
): Promise<EndpointResponseConfig> {
  await ensureEndpoint(endpointId)

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
  await ensureEndpoint(endpointId)

  await getDatabase()
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
        updatedAt: new Date(),
      },
    })

  return {
    mode: "custom",
    ...override,
  } satisfies EndpointResponseConfig
}

export async function clearEndpointResponseOverride(
  endpointId: string
) {
  await ensureEndpoint(endpointId)

  await getDatabase()
    .delete(endpointResponses)
    .where(eq(endpointResponses.endpointId, endpointId))

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

function mapEndpointResponseRow(
  row: typeof endpointResponses.$inferSelect
) {
  return {
    mode: "custom",
    status: row.status,
    contentType: row.contentType,
    body: row.body,
  } satisfies EndpointResponseConfig
}
