import { normalizeEndpointIds } from "./state"
import { parseEndpointId } from "@/lib/webhooks/endpoint-id"

const ACTIVE_ENDPOINT_ID_STORAGE_KEY = "webhooks.lol:endpoint-id"
const RECENT_ENDPOINT_IDS_STORAGE_KEY = "webhooks.lol:recent-endpoint-ids"

export type StoredEndpointSession = {
  activeEndpointId: string | null
  recentEndpointIds: string[]
}

export type EndpointSessionStorage = {
  read: () => StoredEndpointSession
  writeActiveEndpointId: (endpointId: string) => void
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
      const storedEndpointId = storage.getItem(ACTIVE_ENDPOINT_ID_STORAGE_KEY)
      const storedEndpointIds = readRecentEndpointIds(storage)
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
      getStorage().setItem(ACTIVE_ENDPOINT_ID_STORAGE_KEY, endpointId)
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

    return Array.isArray(endpointIds) ? normalizeEndpointIds(endpointIds) : []
  } catch {
    return []
  }
}
