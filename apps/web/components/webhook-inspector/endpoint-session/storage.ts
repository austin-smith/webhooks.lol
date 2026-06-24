import { normalizeEndpointIds } from "./state"
import { parseEndpointId } from "@webhooks-lol/webhooks-core/endpoint-id"

const ACTIVE_ENDPOINT_ID_STORAGE_KEY = "webhooks.lol:endpoint-id"
const RECENT_ENDPOINT_IDS_STORAGE_KEY = "webhooks.lol:recent-endpoint-ids"

type EndpointSessionStorageOptions = {
  userId?: string | null
}

export type StoredEndpointSession = {
  activeEndpointId: string | null
  recentEndpointIds: string[]
}

export type EndpointSessionStorage = {
  read: () => StoredEndpointSession
  writeActiveEndpointId: (endpointId: string) => void
  writeRecentEndpointIds: (endpointIds: string[]) => void
}

export function createBrowserEndpointSessionStorage(
  options: EndpointSessionStorageOptions = {}
): EndpointSessionStorage {
  return createEndpointSessionStorageAdapter(() => window.localStorage, options)
}

export function createEndpointSessionStorageAdapter(
  getStorage: () => Pick<Storage, "getItem" | "setItem">,
  options: EndpointSessionStorageOptions = {}
): EndpointSessionStorage {
  const activeEndpointIdKey = getStorageKey(
    ACTIVE_ENDPOINT_ID_STORAGE_KEY,
    options.userId
  )
  const recentEndpointIdsKey = getStorageKey(
    RECENT_ENDPOINT_IDS_STORAGE_KEY,
    options.userId
  )

  return {
    read() {
      const storage = getStorage()
      const storedEndpointId = storage.getItem(activeEndpointIdKey)
      const storedEndpointIds = readRecentEndpointIds(
        storage,
        recentEndpointIdsKey
      )
      const activeEndpointId =
        (storedEndpointId ? parseEndpointId(storedEndpointId) : null) ??
        storedEndpointIds[0] ??
        null
      const recentEndpointIds =
        activeEndpointId && !storedEndpointIds.includes(activeEndpointId)
          ? normalizeEndpointIds([activeEndpointId, ...storedEndpointIds])
          : storedEndpointIds

      return {
        activeEndpointId,
        recentEndpointIds,
      }
    },
    writeActiveEndpointId(endpointId) {
      getStorage().setItem(activeEndpointIdKey, endpointId)
    },
    writeRecentEndpointIds(endpointIds) {
      getStorage().setItem(
        recentEndpointIdsKey,
        JSON.stringify(normalizeEndpointIds(endpointIds))
      )
    },
  }
}

function readRecentEndpointIds(
  storage: Pick<Storage, "getItem">,
  storageKey: string
) {
  const value = storage.getItem(storageKey)

  if (!value) {
    return []
  }

  try {
    const endpointIds = JSON.parse(value) as unknown

    return Array.isArray(endpointIds) ? normalizeEndpointIds(endpointIds) : []
  } catch {
    return []
  }
}

function getStorageKey(baseKey: string, userId: string | null | undefined) {
  return userId ? `${baseKey}:user:${encodeURIComponent(userId)}` : baseKey
}
