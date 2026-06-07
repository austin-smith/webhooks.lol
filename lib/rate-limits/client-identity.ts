import "server-only"

import { createHash } from "node:crypto"

import { readTrustedClientIpHeader } from "@/lib/rate-limits/config"

export type ClientIdentity = {
  key: string
  keyHash: string | null
  source: "global" | "trusted-header"
}

export class MissingClientIdentityHeaderError extends Error {
  constructor(readonly headerName: string) {
    super(`Required client identity header "${headerName}" is missing.`)
    this.name = "MissingClientIdentityHeaderError"
  }
}

export function isMissingClientIdentityHeaderError(
  error: unknown
): error is MissingClientIdentityHeaderError {
  return error instanceof MissingClientIdentityHeaderError
}

export function readClientIdentity(request: Request): ClientIdentity {
  const trustedHeader = readTrustedClientIpHeader()

  const rawValue = request.headers.get(trustedHeader)
  const clientValue = rawValue ? readFirstHeaderValue(rawValue) : null

  if (!clientValue) {
    throw new MissingClientIdentityHeaderError(trustedHeader)
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
