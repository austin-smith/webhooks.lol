import type { CapturedRequest } from "@/lib/webhook-types"

import type { InboxNames } from "../types"

const MAX_RECENT_TOKENS = 8
const MAX_INBOX_NAME_LENGTH = 32

export function selectRequest(
  requests: CapturedRequest[],
  selectedId: string | null
) {
  return (
    requests.find((request) => request.id === selectedId) ?? requests[0] ?? null
  )
}

export function selectRequestId(
  requests: CapturedRequest[],
  selectedId: string | null
) {
  if (selectedId && requests.some((request) => request.id === selectedId)) {
    return selectedId
  }

  return requests[0]?.id ?? null
}

export function mergeCapturedRequest(
  requests: CapturedRequest[],
  request: CapturedRequest
) {
  return [request, ...requests.filter((item) => item.id !== request.id)]
}

export function rememberInboxToken(token: string, recentTokens: string[]) {
  return normalizeInboxTokens([token, ...recentTokens])
}

export function renameInbox({
  currentNames,
  name,
  recentTokens,
  token,
}: {
  currentNames: InboxNames
  name: string
  recentTokens: string[]
  token: string
}) {
  const nextName = name.slice(0, MAX_INBOX_NAME_LENGTH)
  const knownTokens = normalizeInboxTokens([token, ...recentTokens])
  const nextNames = { ...currentNames }

  if (nextName.trim()) {
    nextNames[token] = nextName
  } else {
    delete nextNames[token]
  }

  return normalizeInboxNames(nextNames, new Set(knownTokens))
}

export function normalizeInboxNames(
  names: Record<string, unknown>,
  tokens: Set<string>
) {
  const nextNames: InboxNames = {}

  for (const [token, name] of Object.entries(names)) {
    if (!tokens.has(token) || typeof name !== "string" || !name.trim()) {
      continue
    }

    nextNames[token] = name.slice(0, MAX_INBOX_NAME_LENGTH)
  }

  return nextNames
}

export function normalizeInboxTokens(tokens: unknown[]) {
  const uniqueTokens = new Set<string>()

  for (const token of tokens) {
    if (typeof token === "string" && token) {
      uniqueTokens.add(token)
    }
  }

  return Array.from(uniqueTokens).slice(0, MAX_RECENT_TOKENS)
}
