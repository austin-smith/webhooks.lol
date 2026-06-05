import {
  normalizeInboxNames,
  normalizeInboxTokens,
} from "./state"
import type { InboxNames } from "../types"

const ACTIVE_TOKEN_STORAGE_KEY = "webhooks.lol:token"
const RECENT_TOKENS_STORAGE_KEY = "webhooks.lol:recent-tokens"
const INBOX_NAMES_STORAGE_KEY = "webhooks.lol:inbox-names"

export type StoredInboxSession = {
  activeToken: string | null
  inboxNames: InboxNames
  recentTokens: string[]
}

export type InboxSessionStorage = {
  read: () => StoredInboxSession
  writeActiveToken: (token: string) => void
  writeInboxNames: (names: InboxNames, recentTokens: string[]) => InboxNames
  writeRecentTokens: (tokens: string[]) => void
}

export function createBrowserInboxSessionStorage(): InboxSessionStorage {
  return createInboxSessionStorageAdapter(() => window.localStorage)
}

export function createInboxSessionStorageAdapter(
  getStorage: () => Pick<Storage, "getItem" | "setItem">
): InboxSessionStorage {
  return {
    read() {
      const storage = getStorage()
      const storedToken = storage.getItem(ACTIVE_TOKEN_STORAGE_KEY)
      const storedTokens = readRecentTokens(storage)
      const activeToken = storedToken ?? storedTokens[0] ?? null
      const recentTokens =
        activeToken && !storedTokens.includes(activeToken)
          ? normalizeInboxTokens([activeToken, ...storedTokens])
          : storedTokens

      return {
        activeToken,
        inboxNames: readInboxNames(storage, recentTokens),
        recentTokens,
      }
    },
    writeActiveToken(token) {
      getStorage().setItem(ACTIVE_TOKEN_STORAGE_KEY, token)
    },
    writeInboxNames(names, recentTokens) {
      const nextNames = normalizeInboxNames(names, new Set(recentTokens))

      getStorage().setItem(INBOX_NAMES_STORAGE_KEY, JSON.stringify(nextNames))

      return nextNames
    },
    writeRecentTokens(tokens) {
      getStorage().setItem(
        RECENT_TOKENS_STORAGE_KEY,
        JSON.stringify(normalizeInboxTokens(tokens))
      )
    },
  }
}

function readRecentTokens(storage: Pick<Storage, "getItem">) {
  const value = storage.getItem(RECENT_TOKENS_STORAGE_KEY)

  if (!value) {
    return []
  }

  try {
    const tokens = JSON.parse(value) as unknown

    return Array.isArray(tokens) ? normalizeInboxTokens(tokens) : []
  } catch {
    return []
  }
}

function readInboxNames(
  storage: Pick<Storage, "getItem">,
  recentTokens: string[]
) {
  const value = storage.getItem(INBOX_NAMES_STORAGE_KEY)

  if (!value) {
    return {}
  }

  try {
    const names = JSON.parse(value) as unknown

    if (!names || typeof names !== "object" || Array.isArray(names)) {
      return {}
    }

    return normalizeInboxNames(
      names as Record<string, unknown>,
      new Set(recentTokens)
    )
  } catch {
    return {}
  }
}
