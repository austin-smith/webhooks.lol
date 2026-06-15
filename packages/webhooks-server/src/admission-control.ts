import "server-only"

import {
  type ConnectionLeasePolicy,
  type RateLimitPolicy,
} from "@webhooks-lol/webhooks-server/rate-limits/config"
import {
  acquireConnectionLease,
  type ConnectionLease,
} from "@webhooks-lol/webhooks-server/rate-limits/connection-leases"
import {
  readClientIdentity,
  type ClientIdentity,
} from "@webhooks-lol/webhooks-server/rate-limits/client-identity"
import type { RateLimitHeadersInput } from "@webhooks-lol/webhooks-server/rate-limits/http"
import {
  checkRateLimit,
  type RateLimitDecision,
} from "@webhooks-lol/webhooks-server/rate-limits/token-bucket"
import {
  webhookRateLimitPolicies,
  webhookEventStreamPolicies,
} from "@webhooks-lol/webhooks-server/policies"

export type AdmissionDecision =
  | {
      kind: "allowed"
      clientIdentity: ClientIdentity
    }
  | {
      kind: "denied"
      rateLimit: RateLimitHeadersInput
    }

export type EventStreamAdmissionDecision =
  | {
      kind: "allowed"
      clientIdentity: ClientIdentity
      lease: EventStreamLease
    }
  | {
      kind: "denied"
      rateLimit: RateLimitHeadersInput
    }

export type EventStreamLease = {
  renew: () => Promise<void>
  release: () => Promise<void>
}

export async function checkEndpointCreateAdmission(
  request: Request
): Promise<AdmissionDecision> {
  const clientIdentity = readClientIdentity(request)

  return checkAdmission(
    [
      [clientIdentity.key, webhookRateLimitPolicies.endpointCreatePerClient],
      ["global", webhookRateLimitPolicies.endpointCreateGlobal],
    ],
    clientIdentity
  )
}

export async function checkWebhookCaptureAdmission({
  endpointId,
  request,
}: {
  endpointId: string
  request: Request
}): Promise<AdmissionDecision> {
  const clientIdentity = readClientIdentity(request)

  return checkAdmission(
    [
      [clientIdentity.key, webhookRateLimitPolicies.webhookCapturePerClient],
      [
        `endpoint:${endpointId}`,
        webhookRateLimitPolicies.webhookCapturePerEndpoint,
      ],
      ["global", webhookRateLimitPolicies.webhookCaptureGlobal],
    ],
    clientIdentity
  )
}

export async function checkWebhookCaptureBodyAdmission({
  bodySize,
  endpointId,
  request,
}: {
  bodySize: number
  endpointId: string
  request: Request
}): Promise<AdmissionDecision> {
  const clientIdentity = readClientIdentity(request)
  const decision = await checkRateLimit(
    `endpoint:${endpointId}`,
    webhookRateLimitPolicies.webhookCaptureBytesPerEndpoint,
    {
      cost: Math.max(1, bodySize),
    }
  )

  if (decision.kind === "denied") {
    return {
      kind: "denied",
      rateLimit: toRateLimitHeaders(decision),
    }
  }

  return {
    kind: "allowed",
    clientIdentity,
  }
}

export async function checkRequestReplayAdmission({
  endpointId,
  request,
  requestId,
}: {
  endpointId: string
  request: Request
  requestId: string
}): Promise<AdmissionDecision> {
  const clientIdentity = readClientIdentity(request)

  return checkAdmission(
    [
      [clientIdentity.key, webhookRateLimitPolicies.requestReplayPerClient],
      [
        `endpoint:${endpointId}`,
        webhookRateLimitPolicies.requestReplayPerEndpoint,
      ],
      [
        `endpoint:${endpointId}:request:${requestId}`,
        webhookRateLimitPolicies.requestReplayPerRequest,
      ],
      ["global", webhookRateLimitPolicies.requestReplayGlobal],
    ],
    clientIdentity
  )
}

export async function acquireEndpointEventStreamAdmission({
  endpointId,
  request,
}: {
  endpointId: string
  request: Request
}): Promise<EventStreamAdmissionDecision> {
  const clientIdentity = readClientIdentity(request)
  const acquiredLeases: Extract<ConnectionLease, { kind: "acquired" }>[] = []

  for (const [key, policy] of [
    [
      `endpoint:${endpointId}`,
      webhookEventStreamPolicies.perEndpointConnections,
    ],
    [clientIdentity.key, webhookEventStreamPolicies.perClientConnections],
    ["global", webhookEventStreamPolicies.globalConnections],
  ] satisfies [string, ConnectionLeasePolicy][]) {
    const lease = await acquireConnectionLease(key, policy)

    if (lease.kind === "denied") {
      await releaseLeases(acquiredLeases)

      return {
        kind: "denied",
        rateLimit: {
          limit: lease.limit,
          policyId: lease.policy.id,
          remaining: lease.remaining,
          resetSeconds: lease.retryAfterSeconds,
          retryAfterSeconds: lease.retryAfterSeconds,
          windowSeconds: lease.policy.leaseSeconds,
        },
      }
    }

    acquiredLeases.push(lease)
  }

  return {
    kind: "allowed",
    clientIdentity,
    lease: {
      async renew() {
        await Promise.all(acquiredLeases.map((lease) => lease.renew()))
      },
      async release() {
        await releaseLeases(acquiredLeases)
      },
    },
  }
}

async function checkAdmission(
  checks: [string, RateLimitPolicy][],
  clientIdentity: ClientIdentity
): Promise<AdmissionDecision> {
  for (const [key, policy] of checks) {
    const decision = await checkRateLimit(key, policy)

    if (decision.kind === "denied") {
      return {
        kind: "denied",
        rateLimit: toRateLimitHeaders(decision),
      }
    }
  }

  return {
    kind: "allowed",
    clientIdentity,
  }
}

async function releaseLeases(
  leases: Extract<ConnectionLease, { kind: "acquired" }>[]
) {
  await Promise.allSettled(leases.map((lease) => lease.release()))
}

function toRateLimitHeaders(
  decision: Extract<RateLimitDecision, { kind: "denied" }>
): RateLimitHeadersInput {
  return {
    limit: decision.limit,
    policyId: decision.policy.id,
    remaining: decision.remaining,
    resetSeconds: decision.resetSeconds,
    retryAfterSeconds: decision.retryAfterSeconds,
    windowSeconds: decision.policy.windowSeconds,
  }
}
