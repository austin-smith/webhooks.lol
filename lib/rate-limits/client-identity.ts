import "server-only"

import { createHash } from "node:crypto"

import { readTrustedClientIpHeader } from "@/lib/rate-limits/config"

export type ClientIdentity = {
  key: string
  keyHash: string | null
  source: "global" | "trusted-header"
}

const GLOBAL_CLIENT_KEY = "client:global"

export function readClientIdentity(request: Request): ClientIdentity {
  const trustedHeader = readTrustedClientIpHeader()

  if (!trustedHeader) {
    return {
      key: GLOBAL_CLIENT_KEY,
      keyHash: null,
      source: "global",
    }
  }

  const rawValue = request.headers.get(trustedHeader)
  const clientValue = rawValue ? readFirstHeaderValue(rawValue) : null

  if (!clientValue) {
    return {
      key: GLOBAL_CLIENT_KEY,
      keyHash: null,
      source: "global",
    }
  }

  const keyHash = hashClientKey(`${trustedHeader}:${clientValue}`)

  return {
    key: `client:${keyHash}`,
    keyHash,
    source: "trusted-header",
  }
}

function readFirstHeaderValue(value: string) {
  return value.split(",")[0]?.trim().toLowerCase()
}

function hashClientKey(value: string) {
  return createHash("sha256")
    .update("webhooks.lol:")
    .update(value)
    .digest("hex")
}
