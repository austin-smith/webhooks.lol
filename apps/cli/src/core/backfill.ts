import { listRequests } from "./api-client.js"
import type { BoundedSet } from "./bounded-set.js"
import type { CapturedRequest } from "./types.js"

const PAGE_SIZE = 100

export interface BackfillResult {
  requests: CapturedRequest[]
  truncated: boolean
}

interface BackfillOptions {
  baseUrl: string
  endpointId: string
  // Stop once a request at or older than this timestamp is reached.
  since: string | null
  delivered: BoundedSet<string>
  maxPages: number
  signal: AbortSignal
}

// Pages back through stored requests (newest first) collecting any that arrived
// after `since` and have not already been delivered, then returns them
// oldest-first so they can be replayed in capture order. Bounded by maxPages.
export async function fetchRequestsSince(
  options: BackfillOptions
): Promise<BackfillResult> {
  const { baseUrl, endpointId, since, delivered, maxPages, signal } = options
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

    let reachedKnown = false
    for (const request of page.requests) {
      if (delivered.has(request.id)) {
        reachedKnown = true
        break
      }

      if (since !== null && request.receivedAt <= since) {
        reachedKnown = true
        break
      }

      collected.push(request)
    }

    if (reachedKnown || !page.hasMore || !page.nextCursor) {
      break
    }

    cursor = page.nextCursor

    if (pages >= maxPages) {
      truncated = true
    }
  }

  collected.reverse()
  return { requests: collected, truncated }
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
