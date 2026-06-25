import { parseEndpointId } from "@webhooks-lol/webhooks-core/endpoint-id"
import type { CapturedRequest } from "@webhooks-lol/webhooks-core/types"
import type { EndpointForwardTarget } from "./transport"

export const MAX_RECENT_ENDPOINTS = 50

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

export function mergeCapturedRequestPage(
  requests: CapturedRequest[],
  loadedRequests: CapturedRequest[]
) {
  const requestsById = new Map(
    [...requests, ...loadedRequests].map((request) => [request.id, request])
  )

  return sortCapturedRequests([...requestsById.values()])
}

export function mergeForwardTarget(
  targets: EndpointForwardTarget[],
  target: EndpointForwardTarget
) {
  return sortForwardTargets([
    target,
    ...targets.filter((item) => item.id !== target.id),
  ])
}

export function replaceForwardTarget(
  targets: EndpointForwardTarget[],
  target: EndpointForwardTarget
) {
  return sortForwardTargets(
    targets.map((item) => (item.id === target.id ? target : item))
  )
}

export function removeForwardTarget(
  targets: EndpointForwardTarget[],
  targetId: string
) {
  return targets.filter((target) => target.id !== targetId)
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

  return sortCapturedRequests(nextRequests)
}

export function rememberEndpointId(
  endpointId: string,
  recentEndpointIds: string[]
) {
  const normalizedRecentEndpointIds = normalizeEndpointIds(recentEndpointIds)
  const normalizedEndpointId = normalizeEndpointIds([endpointId])[0]

  if (!normalizedEndpointId) {
    return normalizedRecentEndpointIds
  }

  if (normalizedRecentEndpointIds.includes(normalizedEndpointId)) {
    return normalizedRecentEndpointIds
  }

  return normalizeEndpointIds([
    normalizedEndpointId,
    ...normalizedRecentEndpointIds,
  ])
}

export function removeEndpointId(
  endpointId: string,
  recentEndpointIds: string[]
) {
  const normalizedEndpointId = normalizeEndpointIds([endpointId])[0]

  if (!normalizedEndpointId) {
    return normalizeEndpointIds(recentEndpointIds)
  }

  return normalizeEndpointIds(recentEndpointIds).filter(
    (recentEndpointId) => recentEndpointId !== normalizedEndpointId
  )
}

export function normalizeEndpointIds(endpointIds: unknown[]) {
  const uniqueEndpointIds = new Set<string>()

  for (const endpointId of endpointIds) {
    if (typeof endpointId === "string") {
      const parsedEndpointId = parseEndpointId(endpointId)

      if (parsedEndpointId) {
        uniqueEndpointIds.add(parsedEndpointId)
      }
    }
  }

  return Array.from(uniqueEndpointIds).slice(0, MAX_RECENT_ENDPOINTS)
}

function sortCapturedRequests(requests: CapturedRequest[]) {
  return requests.sort((left, right) => {
    const receivedAtOrder = right.receivedAt.localeCompare(left.receivedAt)

    if (receivedAtOrder !== 0) {
      return receivedAtOrder
    }

    return right.id.localeCompare(left.id)
  })
}

function sortForwardTargets(targets: EndpointForwardTarget[]) {
  return targets.sort((left, right) => {
    const createdAtOrder = left.createdAt.localeCompare(right.createdAt)

    if (createdAtOrder !== 0) {
      return createdAtOrder
    }

    return left.id.localeCompare(right.id)
  })
}
