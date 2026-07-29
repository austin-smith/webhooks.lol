import "server-only"

import type { ConnectionLeasePolicy } from "@webhooks-lol/webhooks-server/rate-limits/config"
import {
  ACQUIRE_CONNECTION_LEASE_SCRIPT,
  RELEASE_CONNECTION_LEASE_SCRIPT,
  RENEW_CONNECTION_LEASE_SCRIPT,
} from "@webhooks-lol/webhooks-server/rate-limits/redis-scripts"
import {
  getRateLimitStore,
  type RateLimitStore,
} from "@webhooks-lol/webhooks-server/rate-limits/store"

export type ConnectionLease =
  | {
      kind: "acquired"
      id: string
      limit: number
      policy: ConnectionLeasePolicy
      remaining: number
      renew: () => Promise<void>
      release: () => Promise<void>
    }
  | {
      kind: "denied"
      limit: number
      policy: ConnectionLeasePolicy
      remaining: number
      retryAfterSeconds: number
    }

type ConnectionLeaseOptions = {
  leaseId?: string
  now?: Date
  store?: RateLimitStore
}

export async function acquireConnectionLease(
  key: string,
  policy: ConnectionLeasePolicy,
  options: ConnectionLeaseOptions = {}
): Promise<ConnectionLease> {
  const now = options.now ?? new Date()
  const leaseId = options.leaseId ?? crypto.randomUUID()
  const store = options.store ?? getRateLimitStore()
  const leaseMs = policy.leaseSeconds * 1000
  const expiresAtMs = now.getTime() + leaseMs
  const storeKey = connectionLeaseKey(key, policy)
  const result = parseAcquireTuple(
    await store.eval(
      ACQUIRE_CONNECTION_LEASE_SCRIPT,
      [storeKey],
      [
        leaseId,
        String(now.getTime()),
        String(expiresAtMs),
        String(policy.limit),
        String(leaseMs * 2),
      ]
    )
  )

  if (result[0] !== 1) {
    return {
      kind: "denied",
      limit: policy.limit,
      policy,
      remaining: 0,
      retryAfterSeconds: result[2],
    }
  }

  return {
    kind: "acquired",
    id: leaseId,
    limit: policy.limit,
    policy,
    remaining: Math.max(0, policy.limit - result[1]),
    async renew() {
      const renewedAt = Date.now() + leaseMs

      await store.eval(
        RENEW_CONNECTION_LEASE_SCRIPT,
        [storeKey],
        [leaseId, String(renewedAt), String(leaseMs * 2)]
      )
    },
    async release() {
      await store.eval(RELEASE_CONNECTION_LEASE_SCRIPT, [storeKey], [leaseId])
    },
  }
}

function connectionLeaseKey(key: string, policy: ConnectionLeasePolicy) {
  return `connection-lease:${policy.id}:${key}`
}

function parseAcquireTuple(value: unknown): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error("Rate-limit store returned an invalid lease result.")
  }

  const tuple = value.map(Number)

  if (tuple.some((item) => !Number.isFinite(item))) {
    throw new Error("Rate-limit store returned non-numeric lease values.")
  }

  return [tuple[0] ?? 0, tuple[1] ?? 0, tuple[2] ?? 0]
}
