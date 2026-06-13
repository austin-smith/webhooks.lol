import type { CapturedRequest } from "./types.js"

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export interface CreatedEndpoint {
  endpointId: string
  name: string | null
}

export interface RequestPage {
  requests: CapturedRequest[]
  nextCursor: string | null
  hasMore: boolean
}

export interface ListRequestsOptions {
  cursor?: string
  limit?: number
  signal: AbortSignal
}

export function eventStreamUrl(baseUrl: string, endpointId: string): string {
  return new URL(`/api/endpoints/${endpointId}/events`, baseUrl).toString()
}

export function receiveUrl(baseUrl: string, endpointId: string): string {
  return new URL(`/api/hook/${endpointId}`, baseUrl).toString()
}

export async function createEndpoint(
  baseUrl: string,
  signal: AbortSignal
): Promise<CreatedEndpoint> {
  const response = await fetch(new URL("/api/endpoints", baseUrl), {
    method: "POST",
    signal,
  })

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `Failed to create endpoint (status ${response.status}).`
    )
  }

  const data = (await response.json()) as { endpointId: string; name?: unknown }
  return {
    endpointId: data.endpointId,
    name: typeof data.name === "string" ? data.name : null,
  }
}

export async function listRequests(
  baseUrl: string,
  endpointId: string,
  options: ListRequestsOptions
): Promise<RequestPage> {
  const url = new URL(`/api/endpoints/${endpointId}/requests`, baseUrl)
  if (options.cursor) {
    url.searchParams.set("cursor", options.cursor)
  }
  if (options.limit) {
    url.searchParams.set("limit", String(options.limit))
  }

  const response = await fetch(url, { signal: options.signal })

  if (response.status === 404) {
    throw new ApiError(404, "Endpoint not found.")
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `Failed to list requests (status ${response.status}).`
    )
  }

  const data = (await response.json()) as {
    requests: CapturedRequest[]
    page: { nextCursor: string | null; hasMore: boolean }
  }

  return {
    requests: data.requests,
    nextCursor: data.page.nextCursor,
    hasMore: data.page.hasMore,
  }
}

export async function getRequest(
  baseUrl: string,
  endpointId: string,
  requestId: string,
  signal: AbortSignal
): Promise<CapturedRequest | null> {
  const response = await fetch(
    new URL(`/api/endpoints/${endpointId}/requests/${requestId}`, baseUrl),
    { signal }
  )

  if (response.status === 404) {
    const message = await readErrorMessage(response)
    if (message === "Endpoint not found.") {
      throw new ApiError(404, message)
    }

    return null
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `Failed to fetch request (status ${response.status}).`
    )
  }

  const data = (await response.json()) as { request: CapturedRequest }
  return data.request
}

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { error?: unknown }
    return typeof data.error === "string" ? data.error : null
  } catch {
    return null
  }
}
