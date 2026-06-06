import "server-only"

import { and, desc, eq, notInArray, sql } from "drizzle-orm"

import { getDatabase } from "@/lib/database/client"
import { capturedRequests, inboxes } from "@/lib/database/schema"
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

    await transaction.delete(capturedRequests).where(
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
