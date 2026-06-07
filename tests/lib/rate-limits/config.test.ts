import { afterEach, describe, expect, it, vi } from "vitest"

import { LOCAL_REDIS_URL, readRedisUrl } from "@/lib/rate-limits/config"

describe("rate-limit config", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("uses the configured Redis URL", () => {
    vi.stubEnv("REDIS_URL", "redis://redis.example.com:6379")

    expect(readRedisUrl()).toBe("redis://redis.example.com:6379")
  })

  it("uses the local Redis URL outside production when unset", () => {
    vi.stubEnv("REDIS_URL", "")
    vi.stubEnv("NODE_ENV", "development")

    expect(readRedisUrl()).toBe(LOCAL_REDIS_URL)
  })

  it("requires an explicit Redis URL in production", () => {
    vi.stubEnv("REDIS_URL", "")
    vi.stubEnv("NODE_ENV", "production")

    expect(() => readRedisUrl()).toThrow(
      "REDIS_URL is required for rate-limit enforcement."
    )
  })
})
