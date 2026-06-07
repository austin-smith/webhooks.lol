import { describe, expect, it, vi } from "vitest"

import { acquireConnectionLease } from "@/lib/rate-limits/connection-leases"
import type { RateLimitStore } from "@/lib/rate-limits/store"

describe("acquireConnectionLease", () => {
  it("returns acquired leases with renew and release callbacks", async () => {
    const store = {
      eval: vi.fn(async () => [1, 2, 0]),
    } satisfies RateLimitStore
    const lease = await acquireConnectionLease(
      "endpoint:endpoint-id",
      {
        id: "event-streams-endpoint",
        leaseSeconds: 60,
        limit: 3,
      },
      {
        leaseId: "lease-1",
        now: new Date("2026-06-05T00:00:00.000Z"),
        store,
      }
    )

    expect(lease).toEqual(
      expect.objectContaining({
        id: "lease-1",
        kind: "acquired",
        limit: 3,
        remaining: 1,
      })
    )

    if (lease.kind !== "acquired") {
      throw new Error("Expected lease acquisition.")
    }

    await lease.renew()
    await lease.release()

    expect(store.eval).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      ["connection-lease:event-streams-endpoint:endpoint:endpoint-id"],
      ["lease-1", "1780617600000", "1780617660000", "3", "120000"]
    )
    expect(store.eval).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      ["connection-lease:event-streams-endpoint:endpoint:endpoint-id"],
      ["lease-1", expect.any(String), "120000"]
    )
    expect(store.eval).toHaveBeenNthCalledWith(
      3,
      expect.any(String),
      ["connection-lease:event-streams-endpoint:endpoint:endpoint-id"],
      ["lease-1"]
    )
  })

  it("returns denied leases with retry metadata", async () => {
    const store = {
      eval: vi.fn(async () => [0, 3, 45]),
    } satisfies RateLimitStore
    const lease = await acquireConnectionLease(
      "endpoint:endpoint-id",
      {
        id: "event-streams-endpoint",
        leaseSeconds: 60,
        limit: 3,
      },
      {
        leaseId: "lease-1",
        now: new Date("2026-06-05T00:00:00.000Z"),
        store,
      }
    )

    expect(lease).toEqual({
      kind: "denied",
      limit: 3,
      policy: {
        id: "event-streams-endpoint",
        leaseSeconds: 60,
        limit: 3,
      },
      remaining: 0,
      retryAfterSeconds: 45,
    })
  })
})
