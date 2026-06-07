import { describe, expect, it, vi } from "vitest"

import { checkRateLimit } from "@/lib/rate-limits/token-bucket"
import type { RateLimitStore } from "@/lib/rate-limits/store"

describe("checkRateLimit", () => {
  it("returns allowed decisions from the store script result", async () => {
    const store = {
      eval: vi.fn(async () => [1, 9, 0, 12]),
    } satisfies RateLimitStore
    const decision = await checkRateLimit(
      "client:test",
      {
        id: "test-policy",
        limit: 10,
        windowSeconds: 60,
      },
      {
        cost: 2,
        now: new Date("2026-06-05T00:00:00.000Z"),
        store,
      }
    )

    expect(decision).toEqual({
      kind: "allowed",
      limit: 10,
      policy: {
        id: "test-policy",
        limit: 10,
        windowSeconds: 60,
      },
      remaining: 9,
      resetSeconds: 12,
    })
    expect(store.eval).toHaveBeenCalledWith(
      expect.any(String),
      ["rate-limit:test-policy:client:test"],
      ["1780617600000", "10", "60000", "2"]
    )
  })

  it("returns denied decisions with retry metadata", async () => {
    const store = {
      eval: vi.fn(async () => [0, 0, 30, 60]),
    } satisfies RateLimitStore
    const decision = await checkRateLimit(
      "client:test",
      {
        id: "test-policy",
        limit: 10,
        windowSeconds: 60,
      },
      {
        now: new Date("2026-06-05T00:00:00.000Z"),
        store,
      }
    )

    expect(decision).toEqual({
      kind: "denied",
      limit: 10,
      policy: {
        id: "test-policy",
        limit: 10,
        windowSeconds: 60,
      },
      remaining: 0,
      resetSeconds: 60,
      retryAfterSeconds: 30,
    })
  })
})
