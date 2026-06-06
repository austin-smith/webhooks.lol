import {
  normalizeEndpointNames,
  normalizeEndpointIds,
} from "./state"
import type { EndpointNames } from "../types"

const ACTIVE_ENDPOINT_ID_STORAGE_KEY =
  "webhooks.lol:endpoint-id"
const RECENT_ENDPOINT_IDS_STORAGE_KEY =
  "webhooks.lol:recent-endpoint-ids"
const ENDPOINT_NAMES_STORAGE_KEY = "webhooks.lol:endpoint-names"

export type StoredEndpointSession = {
  activeEndpointId: string | null
  endpointNames: EndpointNames
  recentEndpointIds: string[]
}

export type EndpointSessionStorage = {
  read: () => StoredEndpointSession
  writeActiveEndpointId: (endpointId: string) => void
  writeEndpointNames: (
    names: EndpointNames,
    recentEndpointIds: string[]
  ) => EndpointNames
  writeRecentEndpointIds: (endpointIds: string[]) => void
}

export function createBrowserEndpointSessionStorage(): EndpointSessionStorage {
  return createEndpointSessionStorageAdapter(() => window.localStorage)
}

export function createEndpointSessionStorageAdapter(
  getStorage: () => Pick<Storage, "getItem" | "setItem">
): EndpointSessionStorage {
  return {
    read() {
      const storage = getStorage()
      const storedEndpointId = storage.getItem(
        ACTIVE_ENDPOINT_ID_STORAGE_KEY
      )
      const storedEndpointIds = readRecentEndpointIds(storage)
      const activeEndpointId =
        storedEndpointId ?? storedEndpointIds[0] ?? null
      const recentEndpointIds =
        activeEndpointId &&
        !storedEndpointIds.includes(activeEndpointId)
          ? normalizeEndpointIds([
              activeEndpointId,
              ...storedEndpointIds,
            ])
          : storedEndpointIds

      return {
        activeEndpointId,
        endpointNames: readEndpointNames(
          storage,
          recentEndpointIds
        ),
        recentEndpointIds,
      }
    },
    writeActiveEndpointId(endpointId) {
      getStorage().setItem(
        ACTIVE_ENDPOINT_ID_STORAGE_KEY,
        endpointId
      )
    },
    writeEndpointNames(names, recentEndpointIds) {
      const nextNames = normalizeEndpointNames(
        names,
        new Set(recentEndpointIds)
      )

      getStorage().setItem(
        ENDPOINT_NAMES_STORAGE_KEY,
        JSON.stringify(nextNames)
      )

      return nextNames
    },
    writeRecentEndpointIds(endpointIds) {
      getStorage().setItem(
        RECENT_ENDPOINT_IDS_STORAGE_KEY,
        JSON.stringify(normalizeEndpointIds(endpointIds))
      )
    },
  }
}

function readRecentEndpointIds(storage: Pick<Storage, "getItem">) {
  const value = storage.getItem(RECENT_ENDPOINT_IDS_STORAGE_KEY)

  if (!value) {
    return []
  }

  try {
    const endpointIds = JSON.parse(value) as unknown

    return Array.isArray(endpointIds)
      ? normalizeEndpointIds(endpointIds)
      : []
  } catch {
    return []
  }
}

function readEndpointNames(
  storage: Pick<Storage, "getItem">,
  recentEndpointIds: string[]
) {
  const value = storage.getItem(ENDPOINT_NAMES_STORAGE_KEY)

  if (!value) {
    return {}
  }

  try {
    const names = JSON.parse(value) as unknown

    if (!names || typeof names !== "object" || Array.isArray(names)) {
      return {}
    }

    return normalizeEndpointNames(
      names as Record<string, unknown>,
      new Set(recentEndpointIds)
    )
  } catch {
    return {}
  }
}
