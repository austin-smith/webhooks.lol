import "server-only"

import type { RateLimitPolicy } from "@webhooks-lol/webhooks-server/rate-limits/config"
import { TOKEN_BUCKET_SCRIPT } from "@webhooks-lol/webhooks-server/rate-limits/redis-scripts"
import {
  getRateLimitStore,
  type RateLimitStore,
} from "@webhooks-lol/webhooks-server/rate-limits/store"

export type RateLimitDecision =
  | {
      kind: "allowed"
      limit: number
      policy: RateLimitPolicy
      remaining: number
      resetSeconds: number
    }
  | {
      kind: "denied"
      limit: number
      policy: RateLimitPolicy
      remaining: number
      resetSeconds: number
      retryAfterSeconds: number
    }

type TokenBucketOptions = {
  cost?: number
  now?: Date
  store?: RateLimitStore
}

export async function checkRateLimit(
  key: string,
  policy: RateLimitPolicy,
  options: TokenBucketOptions = {}
): Promise<RateLimitDecision> {
  const cost = Math.max(1, Math.ceil(options.cost ?? 1))
  const now = options.now ?? new Date()
  const windowMs = policy.windowSeconds * 1000
  const store = options.store ?? (await getRateLimitStore())
  const result = parseScriptTuple(
    await store.eval(
      TOKEN_BUCKET_SCRIPT,
      [rateLimitKey(key, policy)],
      [
        String(now.getTime()),
        String(policy.limit),
        String(windowMs),
        String(cost),
      ]
    )
  )

  if (result[0] === 1) {
    return {
      kind: "allowed",
      limit: policy.limit,
      policy,
      remaining: result[1],
      resetSeconds: result[3],
    }
  }

  return {
    kind: "denied",
    limit: policy.limit,
    policy,
    remaining: result[1],
    resetSeconds: result[3],
    retryAfterSeconds: result[2],
  }
}

function rateLimitKey(key: string, policy: RateLimitPolicy) {
  return `rate-limit:${policy.id}:${key}`
}

function parseScriptTuple(value: unknown): [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new Error("Rate-limit store returned an invalid token bucket result.")
  }

  const tuple = value.map(Number)

  if (tuple.some((item) => !Number.isFinite(item))) {
    throw new Error("Rate-limit store returned non-numeric bucket values.")
  }

  return [tuple[0] ?? 0, tuple[1] ?? 0, tuple[2] ?? 0, tuple[3] ?? 0]
}
