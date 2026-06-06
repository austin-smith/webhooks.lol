import "server-only"

import { and, desc, eq, notInArray, sql } from "drizzle-orm"

import { getDatabase } from "@/lib/database/client"
import {
  capturedRequests,
  inboxes,
  inboxResponses,
} from "@/lib/database/schema"
import {
  DEFAULT_INBOX_RESPONSE_CONFIG,
  type InboxResponseConfig,
  type InboxResponseOverrideInput,
} from "@/lib/webhooks/inbox-response"
import type {
  CapturedRequest,
  CapturedRequestInput,
} from "@/lib/webhooks/types"

const MAX_REQUESTS_PER_INBOX = 500

export async function createInbox() {
  const token = crypto.randomUUID()
  await ensureInbox(token)
  return token
}

export async function ensureInbox(token: string) {
  await getDatabase()
    .insert(inboxes)
    .values({
      token,
      createdAt: new Date(),
    })
    .onConflictDoNothing({ target: inboxes.token })
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
      .insert(inboxes)
      .values({
        token: request.token,
        createdAt: new Date(),
      })
      .onConflictDoNothing({ target: inboxes.token })

    await transaction.execute(
      sql`select 1 from ${inboxes} where ${inboxes.token} = ${request.token} for update`
    )

    await transaction.insert(capturedRequests).values({
      id: request.id,
      token: request.token,
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
      .where(eq(capturedRequests.token, request.token))
      .orderBy(desc(capturedRequests.receivedAt))
      .limit(MAX_REQUESTS_PER_INBOX)

    await transaction
      .delete(capturedRequests)
      .where(
        and(
          eq(capturedRequests.token, request.token),
          notInArray(capturedRequests.id, retainedRequestIds)
        )
      )
  })

  return request
}

export async function listRequests(token: string) {
  await ensureInbox(token)

  const rows = await getDatabase()
    .select()
    .from(capturedRequests)
    .where(eq(capturedRequests.token, token))
    .orderBy(desc(capturedRequests.receivedAt))
    .limit(MAX_REQUESTS_PER_INBOX)

  return rows.map(mapCapturedRequestRow)
}

export async function clearRequests(token: string) {
  await ensureInbox(token)

  await getDatabase()
    .delete(capturedRequests)
    .where(eq(capturedRequests.token, token))
}

export async function getInboxResponseConfig(
  token: string
): Promise<InboxResponseConfig> {
  await ensureInbox(token)

  const rows = await getDatabase()
    .select()
    .from(inboxResponses)
    .where(eq(inboxResponses.token, token))
    .limit(1)

  const configuredResponse = rows[0]

  if (!configuredResponse) {
    return DEFAULT_INBOX_RESPONSE_CONFIG
  }

  return mapInboxResponseRow(configuredResponse)
}

export async function setInboxResponseOverride({
  token,
  override,
}: {
  token: string
  override: InboxResponseOverrideInput
}) {
  await ensureInbox(token)

  await getDatabase()
    .insert(inboxResponses)
    .values({
      token,
      status: override.status,
      contentType: override.contentType,
      body: override.body,
    })
    .onConflictDoUpdate({
      target: inboxResponses.token,
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
  } satisfies InboxResponseConfig
}

export async function clearInboxResponseOverride(token: string) {
  await ensureInbox(token)

  await getDatabase()
    .delete(inboxResponses)
    .where(eq(inboxResponses.token, token))

  return DEFAULT_INBOX_RESPONSE_CONFIG
}

function mapCapturedRequestRow(row: typeof capturedRequests.$inferSelect) {
  return {
    id: row.id,
    token: row.token,
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

function mapInboxResponseRow(row: typeof inboxResponses.$inferSelect) {
  return {
    mode: "custom",
    status: row.status,
    contentType: row.contentType,
    body: row.body,
  } satisfies InboxResponseConfig
}
