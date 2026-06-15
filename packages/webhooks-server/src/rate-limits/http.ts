import {
  isMissingClientIdentityHeaderError,
  type MissingClientIdentityHeaderError,
} from "@webhooks-lol/webhooks-server/rate-limits/client-identity"

export type RateLimitHeadersInput = {
  limit: number
  policyId: string
  remaining: number
  retryAfterSeconds: number
  resetSeconds: number
  windowSeconds: number
}

export function createRateLimitedResponse({
  body,
  headers,
  rateLimit,
}: {
  body?: Record<string, unknown>
  headers?: HeadersInit
  rateLimit: RateLimitHeadersInput
}) {
  return Response.json(
    {
      ok: false,
      error: "Rate limit exceeded.",
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      ...(body ?? {}),
    },
    {
      headers: {
        ...headers,
        ...createRateLimitHeaders(rateLimit),
      },
      status: 429,
    }
  )
}

export function createMissingClientIdentityHeaderResponse({
  error,
  headers,
}: {
  error: MissingClientIdentityHeaderError
  headers?: HeadersInit
}) {
  return Response.json(
    {
      ok: false,
      error: error.message,
    },
    {
      headers,
      status: 400,
    }
  )
}

export { isMissingClientIdentityHeaderError }

export function createRateLimitHeaders({
  limit,
  policyId,
  remaining,
  retryAfterSeconds,
  resetSeconds,
  windowSeconds,
}: RateLimitHeadersInput) {
  return {
    "Cache-Control": "no-store",
    RateLimit: `"${policyId}";r=${remaining};t=${resetSeconds}`,
    "RateLimit-Policy": `"${policyId}";q=${limit};w=${windowSeconds}`,
    "Retry-After": String(retryAfterSeconds),
  }
}
