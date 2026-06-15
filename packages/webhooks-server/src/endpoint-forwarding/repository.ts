import { and, desc, eq, ne, notInArray, sql } from "drizzle-orm"

import { getDatabase } from "@webhooks-lol/database/connection"
import {
  capturedRequests,
  endpointForwardDeliveries,
  endpointForwardTargets,
  endpoints,
} from "@webhooks-lol/database/schema"
import { mapCapturedRequestRow } from "@webhooks-lol/webhooks-server/captured-request-row"
import {
  assertEndpointForwardTargetUrlCanBeReachedSafely,
  EndpointForwardTargetValidationError,
  normalizeEndpointForwardTargetUrl,
  parseEndpointForwardPathMode,
} from "@webhooks-lol/webhooks-server/endpoint-forwarding/policy"
import type {
  EndpointForwardDelivery,
  EndpointForwardDeliveryStatus,
  EndpointForwardPathMode,
  EndpointForwardTarget,
} from "@webhooks-lol/webhooks-core/endpoint-forwarding"
import { enqueueEndpointForwardDeliveryJob } from "@webhooks-lol/webhooks-server/endpoint-forwarding/queue"
import { MAX_REQUESTS_PER_ENDPOINT } from "@webhooks-lol/webhooks-server/request-retention"
import type { CapturedRequest } from "@webhooks-lol/webhooks-core/types"

const MAX_DELIVERY_ERROR_LENGTH = 1000
const TARGET_DELETED_DELIVERY_ERROR = "Forward target was deleted."
export const MAX_ENDPOINT_FORWARD_TARGETS = 5
export const MAX_ENDPOINT_FORWARD_TARGET_ROWS = 20

export class EndpointForwardingEndpointNotFoundError extends Error {
  constructor(endpointId: string) {
    super(`Endpoint ${endpointId} was not found.`)
    this.name = "EndpointForwardingEndpointNotFoundError"
  }
}

export class EndpointForwardTargetNotFoundError extends Error {
  constructor(targetId: string) {
    super(`Endpoint forward target ${targetId} was not found.`)
    this.name = "EndpointForwardTargetNotFoundError"
  }
}

type WebhooksDatabase = ReturnType<typeof getDatabase>
type DatabaseTransaction = Parameters<
  Parameters<WebhooksDatabase["transaction"]>[0]
>[0]

export type EndpointForwardDeliveryForProcessing = {
  delivery: EndpointForwardDelivery
  target: EndpointForwardTarget
  request: CapturedRequest
}

export async function createEndpointForwardTarget({
  endpointId,
  url,
  pathMode,
}: {
  endpointId: string
  url: string
  pathMode?: string
}) {
  const normalizedUrl = normalizeEndpointForwardTargetUrl(url)
  const normalizedPathMode = parseEndpointForwardPathMode(pathMode)
  const id = crypto.randomUUID()

  await assertEndpointExists(endpointId)
  await assertEndpointForwardTargetUrlCanBeReachedSafely(normalizedUrl)

  const row = await getDatabase().transaction(async (transaction) => {
    await assertEndpointExistsForUpdate({ endpointId, transaction })
    await assertEndpointCanAddForwardTarget({
      endpointId,
      pathMode: normalizedPathMode,
      transaction,
      url: normalizedUrl,
    })

    const [inserted] = await transaction
      .insert(endpointForwardTargets)
      .values({
        id,
        endpointId,
        pathMode: normalizedPathMode,
        url: normalizedUrl,
      })
      .returning()

    return inserted
  })

  if (!row) {
    throw new Error("Could not create endpoint forward target.")
  }

  return mapEndpointForwardTargetRow(row)
}

export async function listEndpointForwardTargets(endpointId: string) {
  await assertEndpointExists(endpointId)

  const rows = await getDatabase()
    .select()
    .from(endpointForwardTargets)
    .where(
      and(
        eq(endpointForwardTargets.endpointId, endpointId),
        eq(endpointForwardTargets.deleted, false)
      )
    )
    .orderBy(endpointForwardTargets.createdAt)

  return rows.map(mapEndpointForwardTargetRow)
}

export async function updateEndpointForwardTarget({
  endpointId,
  targetId,
  enabled,
  pathMode,
  url,
}: {
  endpointId: string
  targetId: string
  enabled?: boolean
  pathMode?: string
  url?: string
}) {
  const values: Partial<typeof endpointForwardTargets.$inferInsert> = {
    updatedAt: new Date(),
  }
  let normalizedUrl: string | undefined
  let normalizedPathMode: EndpointForwardPathMode | undefined

  if (url !== undefined) {
    normalizedUrl = normalizeEndpointForwardTargetUrl(url)
    values.url = normalizedUrl
  }

  if (pathMode !== undefined) {
    normalizedPathMode = parseEndpointForwardPathMode(pathMode)

    values.pathMode = normalizedPathMode
  }

  if (enabled !== undefined) {
    values.enabled = enabled
  }

  await assertEndpointExists(endpointId)

  if (normalizedUrl !== undefined) {
    await assertEndpointForwardTargetExists({ endpointId, targetId })
    await assertEndpointForwardTargetUrlCanBeReachedSafely(normalizedUrl)
  }

  const row = await getDatabase().transaction(async (transaction) => {
    await assertEndpointExistsForUpdate({ endpointId, transaction })
    const currentTarget = await getEndpointForwardTargetRow({
      endpointId,
      targetId,
      transaction,
    })
    const effectiveUrl = normalizedUrl ?? currentTarget.url
    const effectivePathMode =
      normalizedPathMode ?? (currentTarget.pathMode as EndpointForwardPathMode)

    await assertEndpointForwardTargetIsUnique({
      endpointId,
      pathMode: effectivePathMode,
      targetId,
      transaction,
      url: effectiveUrl,
    })

    if (enabled === true && !currentTarget.enabled) {
      await assertEndpointCanEnableForwardTarget({
        endpointId,
        targetId,
        transaction,
      })
    }

    const [updated] = await transaction
      .update(endpointForwardTargets)
      .set(values)
      .where(
        and(
          eq(endpointForwardTargets.id, targetId),
          eq(endpointForwardTargets.endpointId, endpointId),
          eq(endpointForwardTargets.deleted, false)
        )
      )
      .returning()

    return updated
  })

  if (!row) {
    throw new EndpointForwardTargetNotFoundError(targetId)
  }

  return mapEndpointForwardTargetRow(row)
}

export async function deleteEndpointForwardTarget({
  endpointId,
  targetId,
}: {
  endpointId: string
  targetId: string
}) {
  const now = new Date()

  await getDatabase().transaction(async (transaction) => {
    await assertEndpointExistsForUpdate({ endpointId, transaction })
    await getEndpointForwardTargetRow({
      endpointId,
      targetId,
      transaction,
    })

    const [deleted] = await transaction
      .update(endpointForwardTargets)
      .set({
        deleted: true,
        enabled: false,
        updatedAt: now,
      })
      .where(
        and(
          eq(endpointForwardTargets.id, targetId),
          eq(endpointForwardTargets.endpointId, endpointId),
          eq(endpointForwardTargets.deleted, false)
        )
      )
      .returning({ id: endpointForwardTargets.id })

    if (!deleted) {
      throw new EndpointForwardTargetNotFoundError(targetId)
    }

    const cancelledDeliveries = await transaction
      .update(endpointForwardDeliveries)
      .set({
        lastError: TARGET_DELETED_DELIVERY_ERROR,
        lastStatus: null,
        status: "cancelled",
        updatedAt: now,
      })
      .where(
        and(
          eq(endpointForwardDeliveries.endpointId, endpointId),
          eq(endpointForwardDeliveries.targetId, targetId),
          eq(endpointForwardDeliveries.status, "pending")
        )
      )
      .returning({
        requestId: endpointForwardDeliveries.requestId,
      })

    await pruneForwardingCompletedRequests({
      endpointId,
      requestIds: cancelledDeliveries.map((delivery) => delivery.requestId),
      transaction,
    })
  })
}

async function getEndpointForwardTargetRow({
  endpointId,
  targetId,
  transaction,
}: {
  endpointId: string
  targetId: string
  transaction: DatabaseTransaction
}) {
  const [target] = await transaction
    .select()
    .from(endpointForwardTargets)
    .where(
      and(
        eq(endpointForwardTargets.id, targetId),
        eq(endpointForwardTargets.endpointId, endpointId),
        eq(endpointForwardTargets.deleted, false)
      )
    )
    .limit(1)

  if (!target) {
    throw new EndpointForwardTargetNotFoundError(targetId)
  }

  return target
}

export async function enqueueEndpointForwardDeliveriesForRequest({
  request,
  transaction,
}: {
  request: CapturedRequest
  transaction: DatabaseTransaction
}) {
  const targets = await transaction
    .select()
    .from(endpointForwardTargets)
    .where(
      and(
        eq(endpointForwardTargets.endpointId, request.endpointId),
        eq(endpointForwardTargets.enabled, true),
        eq(endpointForwardTargets.deleted, false)
      )
    )

  for (const target of targets) {
    const deliveryId = crypto.randomUUID()

    await transaction.insert(endpointForwardDeliveries).values({
      id: deliveryId,
      endpointId: request.endpointId,
      requestId: request.id,
      status: "pending",
      targetId: target.id,
      targetPathMode: target.pathMode,
      targetUrl: target.url,
    })

    await enqueueEndpointForwardDeliveryJob({
      deliveryId,
      targetId: target.id,
      transaction,
    })
  }
}

export async function getEndpointForwardDeliveryForProcessing(
  deliveryId: string
): Promise<EndpointForwardDeliveryForProcessing | null> {
  const [row] = await getDatabase()
    .select({
      delivery: endpointForwardDeliveries,
      request: capturedRequests,
      target: endpointForwardTargets,
    })
    .from(endpointForwardDeliveries)
    .innerJoin(
      endpointForwardTargets,
      eq(endpointForwardTargets.id, endpointForwardDeliveries.targetId)
    )
    .innerJoin(
      capturedRequests,
      eq(capturedRequests.id, endpointForwardDeliveries.requestId)
    )
    .where(eq(endpointForwardDeliveries.id, deliveryId))
    .limit(1)

  if (!row) {
    return null
  }

  return {
    delivery: mapEndpointForwardDeliveryRow(row.delivery),
    request: mapCapturedRequestRow(row.request),
    target: mapEndpointForwardTargetRow(row.target),
  }
}

export async function recordEndpointForwardDeliveryAttempt({
  deliveryId,
  lastError,
  lastStatus,
  status,
}: {
  deliveryId: string
  lastError: string | null
  lastStatus: number | null
  status: EndpointForwardDeliveryStatus
}) {
  const now = new Date()

  await getDatabase().transaction(async (transaction) => {
    const [row] = await transaction
      .update(endpointForwardDeliveries)
      .set({
        attempts: sql`${endpointForwardDeliveries.attempts} + 1`,
        deliveredAt: status === "delivered" ? now : null,
        lastError: truncateDeliveryError(lastError),
        lastStatus,
        status,
        updatedAt: now,
      })
      .where(eq(endpointForwardDeliveries.id, deliveryId))
      .returning({
        endpointId: endpointForwardDeliveries.endpointId,
        requestId: endpointForwardDeliveries.requestId,
      })

    if (!row || status === "pending") {
      return
    }

    await pruneForwardingCompletedRequests({
      endpointId: row.endpointId,
      requestIds: [row.requestId],
      transaction,
    })
  })
}

export function isEndpointForwardingEndpointUnavailableError(error: unknown) {
  return error instanceof EndpointForwardingEndpointNotFoundError
}

export function isEndpointForwardTargetUnavailableError(error: unknown) {
  return error instanceof EndpointForwardTargetNotFoundError
}

async function assertEndpointExists(endpointId: string) {
  const [row] = await getDatabase()
    .select({ id: endpoints.id })
    .from(endpoints)
    .where(eq(endpoints.id, endpointId))
    .limit(1)

  if (!row) {
    throw new EndpointForwardingEndpointNotFoundError(endpointId)
  }
}

async function assertEndpointForwardTargetExists({
  endpointId,
  targetId,
}: {
  endpointId: string
  targetId: string
}) {
  const [row] = await getDatabase()
    .select({ id: endpointForwardTargets.id })
    .from(endpointForwardTargets)
    .where(
      and(
        eq(endpointForwardTargets.endpointId, endpointId),
        eq(endpointForwardTargets.id, targetId),
        eq(endpointForwardTargets.deleted, false)
      )
    )
    .limit(1)

  if (!row) {
    throw new EndpointForwardTargetNotFoundError(targetId)
  }
}

async function assertEndpointExistsForUpdate({
  endpointId,
  transaction,
}: {
  endpointId: string
  transaction: DatabaseTransaction
}) {
  await transaction.execute(
    sql`select 1 from ${endpoints} where ${endpoints.id} = ${endpointId} for update`
  )
  const [row] = await transaction
    .select({ id: endpoints.id })
    .from(endpoints)
    .where(eq(endpoints.id, endpointId))
    .limit(1)

  if (!row) {
    throw new EndpointForwardingEndpointNotFoundError(endpointId)
  }
}

async function assertEndpointCanAddForwardTarget({
  endpointId,
  pathMode,
  transaction,
  url,
}: {
  endpointId: string
  pathMode: EndpointForwardPathMode
  transaction: DatabaseTransaction
  url: string
}) {
  const [summary] = await transaction
    .select({
      activeTargetCount: sql<number>`cast(count(*) filter (where ${endpointForwardTargets.enabled} and ${endpointForwardTargets.deleted} = false) as integer)`,
      totalTargetCount: sql<number>`cast(count(*) as integer)`,
    })
    .from(endpointForwardTargets)
    .where(
      and(
        eq(endpointForwardTargets.endpointId, endpointId),
        eq(endpointForwardTargets.deleted, false)
      )
    )
  const activeTargetCount = summary?.activeTargetCount ?? 0
  const totalTargetCount = summary?.totalTargetCount ?? 0

  if (activeTargetCount >= MAX_ENDPOINT_FORWARD_TARGETS) {
    throw new EndpointForwardTargetValidationError(
      `Endpoints can have at most ${MAX_ENDPOINT_FORWARD_TARGETS} forward targets.`
    )
  }

  if (totalTargetCount >= MAX_ENDPOINT_FORWARD_TARGET_ROWS) {
    throw new EndpointForwardTargetValidationError(
      `Endpoints can have at most ${MAX_ENDPOINT_FORWARD_TARGET_ROWS} total forward target rows.`
    )
  }

  const [existing] = await transaction
    .select({ id: endpointForwardTargets.id })
    .from(endpointForwardTargets)
    .where(
      and(
        eq(endpointForwardTargets.endpointId, endpointId),
        eq(endpointForwardTargets.url, url),
        eq(endpointForwardTargets.pathMode, pathMode),
        eq(endpointForwardTargets.deleted, false)
      )
    )
    .limit(1)

  if (existing) {
    throw new EndpointForwardTargetValidationError(
      "Forward target already exists for this endpoint."
    )
  }
}

async function assertEndpointForwardTargetIsUnique({
  endpointId,
  pathMode,
  targetId,
  transaction,
  url,
}: {
  endpointId: string
  pathMode: EndpointForwardPathMode
  targetId: string
  transaction: DatabaseTransaction
  url: string
}) {
  const [existing] = await transaction
    .select({ id: endpointForwardTargets.id })
    .from(endpointForwardTargets)
    .where(
      and(
        eq(endpointForwardTargets.endpointId, endpointId),
        eq(endpointForwardTargets.url, url),
        eq(endpointForwardTargets.pathMode, pathMode),
        ne(endpointForwardTargets.id, targetId),
        eq(endpointForwardTargets.deleted, false)
      )
    )
    .limit(1)

  if (existing) {
    throw new EndpointForwardTargetValidationError(
      "Forward target already exists for this endpoint."
    )
  }
}

async function assertEndpointCanEnableForwardTarget({
  endpointId,
  targetId,
  transaction,
}: {
  endpointId: string
  targetId: string
  transaction: DatabaseTransaction
}) {
  const [summary] = await transaction
    .select({
      targetCount: sql<number>`cast(count(*) as integer)`,
    })
    .from(endpointForwardTargets)
    .where(
      and(
        eq(endpointForwardTargets.endpointId, endpointId),
        eq(endpointForwardTargets.enabled, true),
        ne(endpointForwardTargets.id, targetId),
        eq(endpointForwardTargets.deleted, false)
      )
    )
  const targetCount = summary?.targetCount ?? 0

  if (targetCount >= MAX_ENDPOINT_FORWARD_TARGETS) {
    throw new EndpointForwardTargetValidationError(
      `Endpoints can have at most ${MAX_ENDPOINT_FORWARD_TARGETS} forward targets.`
    )
  }
}

async function pruneForwardingCompletedRequests({
  endpointId,
  requestIds,
  transaction,
}: {
  endpointId: string
  requestIds: string[]
  transaction: DatabaseTransaction
}) {
  for (const requestId of new Set(requestIds)) {
    const activeForwardingRequestIds = transaction
      .select({ id: endpointForwardDeliveries.requestId })
      .from(endpointForwardDeliveries)
      .where(
        and(
          eq(endpointForwardDeliveries.requestId, requestId),
          eq(endpointForwardDeliveries.status, "pending")
        )
      )

    await transaction
      .delete(capturedRequests)
      .where(
        and(
          eq(capturedRequests.id, requestId),
          eq(capturedRequests.deleteAfterForwarding, true),
          notInArray(capturedRequests.id, activeForwardingRequestIds)
        )
      )
  }

  const retainedRequestIds = transaction
    .select({ id: capturedRequests.id })
    .from(capturedRequests)
    .where(
      and(
        eq(capturedRequests.endpointId, endpointId),
        eq(capturedRequests.deleteAfterForwarding, false)
      )
    )
    .orderBy(desc(capturedRequests.receivedAt), desc(capturedRequests.id))
    .limit(MAX_REQUESTS_PER_ENDPOINT)
  const activeEndpointForwardingRequestIds = transaction
    .select({ id: endpointForwardDeliveries.requestId })
    .from(endpointForwardDeliveries)
    .where(
      and(
        eq(endpointForwardDeliveries.endpointId, endpointId),
        eq(endpointForwardDeliveries.status, "pending")
      )
    )

  await transaction
    .delete(capturedRequests)
    .where(
      and(
        eq(capturedRequests.endpointId, endpointId),
        eq(capturedRequests.deleteAfterForwarding, false),
        notInArray(capturedRequests.id, retainedRequestIds),
        notInArray(capturedRequests.id, activeEndpointForwardingRequestIds)
      )
    )
}

function mapEndpointForwardTargetRow(
  row: typeof endpointForwardTargets.$inferSelect
) {
  return {
    id: row.id,
    endpointId: row.endpointId,
    url: row.url,
    pathMode: row.pathMode as EndpointForwardPathMode,
    enabled: row.enabled,
    deleted: row.deleted,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  } satisfies EndpointForwardTarget
}

function mapEndpointForwardDeliveryRow(
  row: typeof endpointForwardDeliveries.$inferSelect
) {
  return {
    id: row.id,
    endpointId: row.endpointId,
    targetId: row.targetId,
    requestId: row.requestId,
    targetUrl: row.targetUrl,
    targetPathMode: row.targetPathMode as EndpointForwardPathMode,
    status: row.status as EndpointForwardDeliveryStatus,
    attempts: row.attempts,
    lastStatus: row.lastStatus,
    lastError: row.lastError,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  } satisfies EndpointForwardDelivery
}

function truncateDeliveryError(error: string | null) {
  if (!error || error.length <= MAX_DELIVERY_ERROR_LENGTH) {
    return error
  }

  return error.slice(0, MAX_DELIVERY_ERROR_LENGTH)
}
