import type { CapturedRequest } from "@/lib/webhooks/types"

import type { EndpointNames } from "../types"

const MAX_RECENT_ENDPOINTS = 8
const MAX_ENDPOINT_NAME_LENGTH = 32

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

export function reconcileLoadedRequests({
  currentRequests,
  loadedRequests,
  requestIdsAtLoadStart,
}: {
  currentRequests: CapturedRequest[]
  loadedRequests: CapturedRequest[]
  requestIdsAtLoadStart: Set<string>
}) {
  const loadedById = new Map(
    loadedRequests.map((request) => [request.id, request])
  )
  const nextRequests = [...loadedById.values()]

  for (const request of currentRequests) {
    if (requestIdsAtLoadStart.has(request.id) || loadedById.has(request.id)) {
      continue
    }

    nextRequests.push(request)
  }

  return nextRequests.sort((left, right) =>
    right.receivedAt.localeCompare(left.receivedAt)
  )
}

export function rememberEndpointId(
  endpointId: string,
  recentEndpointIds: string[]
) {
  return normalizeEndpointIds([
    endpointId,
    ...recentEndpointIds,
  ])
}

export function renameEndpoint({
  currentNames,
  name,
  recentEndpointIds,
  endpointId,
}: {
  currentNames: EndpointNames
  name: string
  recentEndpointIds: string[]
  endpointId: string
}) {
  const nextName = name.slice(0, MAX_ENDPOINT_NAME_LENGTH)
  const knownEndpointIds = normalizeEndpointIds([
    endpointId,
    ...recentEndpointIds,
  ])
  const nextNames = { ...currentNames }

  if (nextName.trim()) {
    nextNames[endpointId] = nextName
  } else {
    delete nextNames[endpointId]
  }

  return normalizeEndpointNames(
    nextNames,
    new Set(knownEndpointIds)
  )
}

export function normalizeEndpointNames(
  names: Record<string, unknown>,
  endpointIds: Set<string>
) {
  const nextNames: EndpointNames = {}

  for (const [endpointId, name] of Object.entries(names)) {
    if (
      !endpointIds.has(endpointId) ||
      typeof name !== "string" ||
      !name.trim()
    ) {
      continue
    }

    nextNames[endpointId] = name.slice(0, MAX_ENDPOINT_NAME_LENGTH)
  }

  return nextNames
}

export function normalizeEndpointIds(endpointIds: unknown[]) {
  const uniqueEndpointIds = new Set<string>()

  for (const endpointId of endpointIds) {
    if (typeof endpointId === "string" && endpointId) {
      uniqueEndpointIds.add(endpointId)
    }
  }

  return Array.from(uniqueEndpointIds).slice(
    0,
    MAX_RECENT_ENDPOINTS
  )
}
