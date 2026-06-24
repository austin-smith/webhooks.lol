import type { StoredEndpointSession } from "./storage"
import { normalizeEndpointIds } from "./state"
import type { EndpointMetadata } from "./transport"

export function getSignedInStoredEndpointIds({
  accountEndpointIds,
  accountSession,
  anonymousSession,
}: {
  accountEndpointIds: string[]
  accountSession: StoredEndpointSession
  anonymousSession: StoredEndpointSession
}) {
  const accountEndpointIdSet = new Set(accountEndpointIds)

  return normalizeEndpointIds([
    ...accountSession.recentEndpointIds,
    ...anonymousSession.recentEndpointIds,
  ]).filter((endpointId) => !accountEndpointIdSet.has(endpointId))
}

export function resolveSignedInEndpointRestore({
  accountEndpoints,
  accountSession,
  anonymousSession,
  preferredActiveEndpointId = null,
  storedEndpoints,
}: {
  accountEndpoints: EndpointMetadata[]
  accountSession: StoredEndpointSession
  anonymousSession: StoredEndpointSession
  preferredActiveEndpointId?: string | null
  storedEndpoints: EndpointMetadata[]
}) {
  const metadata = mergeEndpointMetadata(accountEndpoints, storedEndpoints)
  const metadataById = new Map(
    metadata.map((endpoint) => [endpoint.endpointId, endpoint])
  )
  const endpointIds = normalizeEndpointIds([
    preferredActiveEndpointId,
    ...accountSession.recentEndpointIds,
    ...anonymousSession.recentEndpointIds,
    ...accountEndpoints.map((endpoint) => endpoint.endpointId),
    ...storedEndpoints.map((endpoint) => endpoint.endpointId),
  ]).filter((endpointId) => metadataById.has(endpointId))
  const activeEndpointId = normalizeEndpointIds([
    preferredActiveEndpointId,
    accountSession.activeEndpointId,
    anonymousSession.activeEndpointId,
    ...endpointIds,
  ]).find((endpointId) => metadataById.has(endpointId))

  return {
    activeEndpoint: activeEndpointId
      ? (metadataById.get(activeEndpointId) ?? null)
      : null,
    endpointIds,
    metadata,
  }
}

function mergeEndpointMetadata(
  accountEndpoints: EndpointMetadata[],
  storedEndpoints: EndpointMetadata[]
) {
  const metadataById = new Map<string, EndpointMetadata>()

  for (const endpoint of [...accountEndpoints, ...storedEndpoints]) {
    if (!metadataById.has(endpoint.endpointId)) {
      metadataById.set(endpoint.endpointId, endpoint)
    }
  }

  return Array.from(metadataById.values())
}
