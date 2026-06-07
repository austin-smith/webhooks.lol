import { afterEach, describe, expect, it, vi } from "vitest"

import {
  LOCAL_REDIS_URL,
  readRedisUrl,
  readTrustedClientIpHeader,
} from "@/lib/rate-limits/config"

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

  it("requires a trusted client IP header", () => {
    vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", "")

    expect(() => readTrustedClientIpHeader()).toThrow(
      "TRUSTED_CLIENT_IP_HEADER is required for rate limiting."
    )
  })

  it("normalizes the trusted client IP header name", () => {
    vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", " X-Forwarded-For ")

    expect(readTrustedClientIpHeader()).toBe("x-forwarded-for")
  })
})
