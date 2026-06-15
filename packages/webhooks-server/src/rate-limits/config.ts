import "server-only"

export type RateLimitPolicy = {
  id: string
  limit: number
  windowSeconds: number
}

export type ConnectionLeasePolicy = {
  id: string
  limit: number
  leaseSeconds: number
}

export const LOCAL_REDIS_URL = "redis://localhost:6379"

export function readRedisUrl() {
  const redisUrl = process.env.REDIS_URL

  if (redisUrl) {
    return redisUrl
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("REDIS_URL is required for rate-limit enforcement.")
  }

  return LOCAL_REDIS_URL
}

export function readTrustedClientIpHeader() {
  const headerName = process.env.TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase()

  if (!headerName) {
    throw new Error("TRUSTED_CLIENT_IP_HEADER is required for rate limiting.")
  }

  return headerName
}
