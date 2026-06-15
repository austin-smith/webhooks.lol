import type { capturedRequests } from "@webhooks-lol/database/schema"
import type { CapturedRequest } from "@webhooks-lol/webhooks-core/types"

export function mapCapturedRequestRow(
  row: typeof capturedRequests.$inferSelect
) {
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
