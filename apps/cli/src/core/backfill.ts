import { listRequests } from "./api-client.js"
import type { CapturedRequest } from "./types.js"

const PAGE_SIZE = 100

export interface BackfillResult {
  requests: CapturedRequest[]
  truncated: boolean
}

// Pages through all stored requests (bounded), returned newest-first as the API
// orders them. Used by replay to gather candidates for client-side filtering.
export async function fetchAllRequests(options: {
  baseUrl: string
  endpointId: string
  maxPages: number
  signal: AbortSignal
}): Promise<BackfillResult> {
  const { baseUrl, endpointId, maxPages, signal } = options
  const collected: CapturedRequest[] = []
  let cursor: string | undefined
  let pages = 0
  let truncated = false

  while (pages < maxPages) {
    const page = await listRequests(baseUrl, endpointId, {
      cursor,
      limit: PAGE_SIZE,
      signal,
    })
    pages += 1
    collected.push(...page.requests)

    if (!page.hasMore || !page.nextCursor) {
      break
    }

    cursor = page.nextCursor

    if (pages >= maxPages) {
      truncated = true
    }
  }

  return { requests: collected, truncated }
}
