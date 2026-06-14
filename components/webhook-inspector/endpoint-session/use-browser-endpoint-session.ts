"use client"

import * as React from "react"

import {
  DEFAULT_ENDPOINT_RESPONSE_CONFIG,
  type EndpointResponseConfig,
  type EndpointResponseOverrideInput,
} from "@/lib/webhooks/endpoint-response"
import {
  EMPTY_REQUEST_SEARCH,
  requestMatchesSearch,
  type RequestSearchCriteria,
} from "@/lib/webhooks/request-search"
import type { CapturedRequest } from "@/lib/webhooks/types"

import type {
  ConnectionState,
  EndpointActions,
  EndpointForwardPathMode,
  EndpointNames,
  Endpoint,
} from "../types"
import { createBrowserEndpointEventStream } from "./event-stream"
import {
  mergeForwardTarget,
  mergeCapturedRequestPage,
  mergeCapturedRequest,
  rememberEndpointId,
  reconcileLoadedRequests,
  removeForwardTarget,
  replaceForwardTarget,
  selectRequest,
  selectRequestId,
} from "./state"
import { createBrowserEndpointSessionStorage } from "./storage"
import {
  type CapturedRequestPage,
  createFetchEndpointTransport,
  type EndpointForwardTarget,
  type EndpointMetadata,
  type EndpointStats,
} from "./transport"

type EndpointRenameSaveState = {
  isSaving: boolean
  pendingName: string | null
}

export function useBrowserEndpointSession(): Endpoint {
  const storage = React.useMemo(() => createBrowserEndpointSessionStorage(), [])
  const transport = React.useMemo(() => createFetchEndpointTransport(), [])
  const eventStream = React.useMemo(
    () => createBrowserEndpointEventStream(),
    []
  )
  const hasLoadedStorage = React.useRef(false)
  const activeEndpointIdRef = React.useRef<string | null>(null)
  const forwardTargetListVersion = React.useRef(0)
  const isSavingForwardTargetRef = React.useRef(false)
  const requestListVersion = React.useRef(0)
  const requestSearchRef =
    React.useRef<RequestSearchCriteria>(EMPTY_REQUEST_SEARCH)
  const replayingRequestIdsRef = React.useRef<Set<string>>(new Set())
  const renameSaveStatesByEndpoint = React.useRef(
    new Map<string, EndpointRenameSaveState>()
  )
  const [endpointId, setEndpointId] = React.useState<string | null>(null)
  const [endpointNames, setEndpointNames] = React.useState<EndpointNames>({})
  const [recentEndpointIds, setRecentEndpointIds] = React.useState<string[]>([])
  const [requestState, setRequestState] = React.useState<{
    hasMoreRequests: boolean
    nextCursor: string | null
    requests: CapturedRequest[]
    selectedId: string | null
  }>({
    hasMoreRequests: false,
    nextCursor: null,
    requests: [],
    selectedId: null,
  })
  const [requestSearch, setRequestSearch] =
    React.useState<RequestSearchCriteria>(EMPTY_REQUEST_SEARCH)
  const [forwardTargets, setForwardTargets] = React.useState<
    EndpointForwardTarget[]
  >([])
  const [responseConfig, setResponseConfig] =
    React.useState<EndpointResponseConfig>(DEFAULT_ENDPOINT_RESPONSE_CONFIG)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isClearing, setIsClearing] = React.useState(false)
  const [isLoadingForwardTargets, setIsLoadingForwardTargets] =
    React.useState(false)
  const [isLoadingOlderRequests, setIsLoadingOlderRequests] =
    React.useState(false)
  const [isSavingForwardTarget, setIsSavingForwardTarget] =
    React.useState(false)
  const [isSavingResponse, setIsSavingResponse] = React.useState(false)
  const [replayingRequestIds, setReplayingRequestIds] = React.useState<
    Set<string>
  >(() => new Set())
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [connectionState, setConnectionState] =
    React.useState<ConnectionState>("connecting")
  const { hasMoreRequests, nextCursor, requests, selectedId } = requestState

  const selectedRequest = selectRequest(requests, selectedId)
  const isReplayingSelectedRequest = selectedRequest
    ? replayingRequestIds.has(selectedRequest.id)
    : false

  const updateEndpointId = React.useCallback((nextEndpointId: string) => {
    activeEndpointIdRef.current = nextEndpointId
    setEndpointId(nextEndpointId)
  }, [])

  const applyLoadedRequests = React.useCallback(
    ({
      requestListVersionAtLoadStart,
      page,
      requestIdsAtLoadStart,
    }: {
      requestListVersionAtLoadStart: number
      page: CapturedRequestPage
      requestIdsAtLoadStart: Set<string>
    }) => {
      setRequestState((current) => {
        if (requestListVersion.current !== requestListVersionAtLoadStart) {
          return current
        }

        const nextRequests = reconcileLoadedRequests({
          currentRequests: current.requests,
          loadedRequests: page.requests,
          requestIdsAtLoadStart,
        })

        return {
          hasMoreRequests: page.hasMore,
          nextCursor: page.nextCursor,
          requests: nextRequests,
          selectedId: selectRequestId(nextRequests, current.selectedId),
        }
      })
    },
    []
  )

  const resetRequestSearch = React.useCallback(() => {
    requestSearchRef.current = EMPTY_REQUEST_SEARCH
    setRequestSearch(EMPTY_REQUEST_SEARCH)
  }, [])

  const rememberActiveEndpointId = React.useCallback(
    (nextEndpointId: string) => {
      setRecentEndpointIds((current) =>
        rememberEndpointId(nextEndpointId, current)
      )
    },
    []
  )

  const applyEndpointMetadata = React.useCallback(
    (metadata: EndpointMetadata) => {
      setEndpointNames((currentNames) => {
        const nextNames = { ...currentNames }

        if (metadata.name?.trim()) {
          nextNames[metadata.endpointId] = metadata.name
        } else {
          delete nextNames[metadata.endpointId]
        }

        return nextNames
      })
    },
    []
  )

  const applyEndpointMetadataList = React.useCallback(
    (metadataList: EndpointMetadata[]) => {
      setEndpointNames((currentNames) => {
        const nextNames = { ...currentNames }

        for (const metadata of metadataList) {
          if (metadata.name?.trim()) {
            nextNames[metadata.endpointId] = metadata.name
          } else {
            delete nextNames[metadata.endpointId]
          }
        }

        return nextNames
      })
    },
    []
  )

  const applyNewEndpoint = React.useCallback(
    (metadata: EndpointMetadata) => {
      const nextEndpointId = metadata.endpointId

      hasLoadedStorage.current = true
      rememberActiveEndpointId(nextEndpointId)
      updateEndpointId(nextEndpointId)
      applyEndpointMetadata(metadata)
      setRequestState({
        hasMoreRequests: false,
        nextCursor: null,
        requests: [],
        selectedId: null,
      })
      setForwardTargets([])
      forwardTargetListVersion.current += 1
      replayingRequestIdsRef.current = new Set()
      setReplayingRequestIds(replayingRequestIdsRef.current)
      requestListVersion.current += 1
      resetRequestSearch()
      setResponseConfig(DEFAULT_ENDPOINT_RESPONSE_CONFIG)
      setErrorMessage(null)
      setConnectionState("connecting")
      setIsLoadingOlderRequests(false)
      setIsLoadingForwardTargets(false)
      isSavingForwardTargetRef.current = false
      setIsSavingForwardTarget(false)
      setIsLoading(false)
    },
    [
      applyEndpointMetadata,
      rememberActiveEndpointId,
      resetRequestSearch,
      updateEndpointId,
    ]
  )

  const createEndpoint = React.useCallback(async () => {
    const metadata = await transport.createEndpoint()

    applyNewEndpoint(metadata)
  }, [applyNewEndpoint, transport])

  React.useEffect(() => {
    let isActive = true

    queueMicrotask(() => {
      if (!isActive) {
        return
      }

      const storedSession = storage.read()
      const activeEndpointId = storedSession.activeEndpointId

      hasLoadedStorage.current = true
      setRecentEndpointIds(storedSession.recentEndpointIds)

      if (activeEndpointId) {
        // Reveal the restored endpoint identity (URL, switcher label, live
        // connection) immediately so a refresh does not flash placeholders.
        // Only the captured-request list waits on the network.
        updateEndpointId(activeEndpointId)
        const requestIdsAtLoadStart = new Set<string>()
        const requestListVersionAtLoadStart = requestListVersion.current

        void (async () => {
          try {
            const [
              nextRequestPage,
              nextResponseConfig,
              nextForwardTargets,
              metadataResults,
            ] = await Promise.all([
              transport.loadRequests(activeEndpointId),
              transport.loadEndpointResponseConfig(activeEndpointId),
              transport.listForwardTargets(activeEndpointId),
              Promise.allSettled(
                storedSession.recentEndpointIds.map((recentEndpointId) =>
                  transport.loadEndpoint(recentEndpointId)
                )
              ),
            ])
            const restoredEndpointMetadata = metadataResults.flatMap(
              (result) => (result.status === "fulfilled" ? [result.value] : [])
            )

            if (!isActive || activeEndpointIdRef.current !== activeEndpointId) {
              return
            }

            applyEndpointMetadataList(restoredEndpointMetadata)
            applyLoadedRequests({
              requestListVersionAtLoadStart,
              page: nextRequestPage,
              requestIdsAtLoadStart,
            })
            setForwardTargets(nextForwardTargets)
            setResponseConfig(nextResponseConfig)
            setErrorMessage(null)
          } catch (error) {
            if (isActive && activeEndpointIdRef.current === activeEndpointId) {
              setErrorMessage(readErrorMessage(error))
            }
          } finally {
            if (isActive && activeEndpointIdRef.current === activeEndpointId) {
              setIsLoading(false)
            }
          }
        })()

        return
      }

      void (async () => {
        try {
          const metadata = await transport.createEndpoint()

          if (isActive) {
            applyNewEndpoint(metadata)
          }
        } catch (error: unknown) {
          if (isActive) {
            setErrorMessage(readErrorMessage(error))
            setIsLoading(false)
          }
        }
      })()
    })

    return () => {
      isActive = false
    }
  }, [
    applyEndpointMetadataList,
    applyLoadedRequests,
    applyNewEndpoint,
    storage,
    transport,
    updateEndpointId,
  ])

  React.useEffect(() => {
    if (!hasLoadedStorage.current || !endpointId) {
      return
    }

    storage.writeActiveEndpointId(endpointId)
  }, [storage, endpointId])

  React.useEffect(() => {
    if (!hasLoadedStorage.current) {
      return
    }

    storage.writeRecentEndpointIds(recentEndpointIds)
  }, [recentEndpointIds, storage])

  React.useEffect(() => {
    if (!endpointId) {
      return
    }

    return eventStream.subscribe(endpointId, {
      onClear() {
        requestListVersion.current += 1
        setRequestState({
          hasMoreRequests: false,
          nextCursor: null,
          requests: [],
          selectedId: null,
        })
        setIsLoadingOlderRequests(false)
        setConnectionState("live")
      },
      onError() {
        setConnectionState("offline")
      },
      onReady() {
        setConnectionState("live")
      },
      onRequest(request) {
        if (!requestMatchesSearch(request, requestSearchRef.current)) {
          setConnectionState("live")
          return
        }

        setRequestState((current) => ({
          hasMoreRequests: current.hasMoreRequests,
          nextCursor: current.nextCursor,
          requests: mergeCapturedRequest(current.requests, request),
          selectedId: request.id,
        }))
        setConnectionState("live")
      },
    })
  }, [eventStream, endpointId])

  const refreshEndpoint = React.useCallback(async () => {
    if (!endpointId) {
      return
    }

    const requestIdsAtLoadStart = new Set(requests.map((request) => request.id))
    const requestListVersionAtLoadStart = requestListVersion.current
    const loadingEndpointId = endpointId

    try {
      const nextRequestPage = await transport.loadRequests(loadingEndpointId, {
        search: requestSearchRef.current,
      })

      if (activeEndpointIdRef.current !== loadingEndpointId) {
        return
      }

      applyLoadedRequests({
        requestListVersionAtLoadStart,
        page: nextRequestPage,
        requestIdsAtLoadStart,
      })
      setErrorMessage(null)
    } catch (error) {
      if (activeEndpointIdRef.current === loadingEndpointId) {
        setErrorMessage(readErrorMessage(error))
      }
    }
  }, [applyLoadedRequests, requests, endpointId, transport])

  const loadOlderRequests = React.useCallback(async () => {
    if (!endpointId || !nextCursor || isLoading || isLoadingOlderRequests) {
      return
    }

    const loadingEndpointId = endpointId
    const cursorAtLoadStart = nextCursor
    const requestListVersionAtLoadStart = requestListVersion.current

    setIsLoadingOlderRequests(true)

    try {
      const nextRequestPage = await transport.loadRequests(loadingEndpointId, {
        cursor: cursorAtLoadStart,
        search: requestSearchRef.current,
      })

      if (activeEndpointIdRef.current !== loadingEndpointId) {
        return
      }

      setRequestState((current) => {
        if (requestListVersion.current !== requestListVersionAtLoadStart) {
          return current
        }

        const nextRequests = mergeCapturedRequestPage(
          current.requests,
          nextRequestPage.requests
        )

        return {
          hasMoreRequests: nextRequestPage.hasMore,
          nextCursor: nextRequestPage.nextCursor,
          requests: nextRequests,
          selectedId: selectRequestId(nextRequests, current.selectedId),
        }
      })
      setErrorMessage(null)
    } catch (error) {
      if (activeEndpointIdRef.current === loadingEndpointId) {
        setErrorMessage(readErrorMessage(error))
      }
    } finally {
      setIsLoadingOlderRequests(false)
    }
  }, [endpointId, isLoading, isLoadingOlderRequests, nextCursor, transport])

  const searchRequests = React.useCallback(
    (nextSearch: RequestSearchCriteria) => {
      requestSearchRef.current = nextSearch
      requestListVersion.current += 1
      setRequestSearch(nextSearch)
      setRequestState({
        hasMoreRequests: false,
        nextCursor: null,
        requests: [],
        selectedId: null,
      })
      setIsLoadingOlderRequests(false)

      if (!endpointId) {
        return
      }

      const loadingEndpointId = endpointId
      const requestIdsAtLoadStart = new Set<string>()
      const requestListVersionAtLoadStart = requestListVersion.current

      setIsLoading(true)

      void (async () => {
        try {
          const nextRequestPage = await transport.loadRequests(
            loadingEndpointId,
            {
              search: nextSearch,
            }
          )

          if (activeEndpointIdRef.current !== loadingEndpointId) {
            return
          }

          applyLoadedRequests({
            requestListVersionAtLoadStart,
            page: nextRequestPage,
            requestIdsAtLoadStart,
          })

          if (
            requestListVersion.current === requestListVersionAtLoadStart &&
            activeEndpointIdRef.current === loadingEndpointId
          ) {
            setErrorMessage(null)
          }
        } catch (error) {
          if (
            requestListVersion.current === requestListVersionAtLoadStart &&
            activeEndpointIdRef.current === loadingEndpointId
          ) {
            setErrorMessage(readErrorMessage(error))
          }
        } finally {
          if (
            requestListVersion.current === requestListVersionAtLoadStart &&
            activeEndpointIdRef.current === loadingEndpointId
          ) {
            setIsLoading(false)
          }
        }
      })()
    },
    [applyLoadedRequests, endpointId, transport]
  )

  const clearEndpoint = React.useCallback(async () => {
    if (!endpointId || isClearing) {
      return
    }

    setIsClearing(true)

    try {
      await transport.clearEndpoint(endpointId)
      requestListVersion.current += 1
      setRequestState({
        hasMoreRequests: false,
        nextCursor: null,
        requests: [],
        selectedId: null,
      })
      setIsLoadingOlderRequests(false)
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(readErrorMessage(error))
    } finally {
      setIsClearing(false)
    }
  }, [isClearing, endpointId, transport])

  const loadForwardTargets = React.useCallback(async () => {
    if (!endpointId || isLoadingForwardTargets) {
      return
    }

    const loadingEndpointId = endpointId
    const forwardTargetListVersionAtLoadStart = forwardTargetListVersion.current

    setIsLoadingForwardTargets(true)

    try {
      const nextForwardTargets =
        await transport.listForwardTargets(loadingEndpointId)

      if (
        activeEndpointIdRef.current === loadingEndpointId &&
        forwardTargetListVersion.current === forwardTargetListVersionAtLoadStart
      ) {
        setForwardTargets(nextForwardTargets)
        setErrorMessage(null)
      }
    } catch (error) {
      if (activeEndpointIdRef.current === loadingEndpointId) {
        setErrorMessage(readErrorMessage(error))
      }

      throw error
    } finally {
      if (activeEndpointIdRef.current === loadingEndpointId) {
        setIsLoadingForwardTargets(false)
      }
    }
  }, [endpointId, isLoadingForwardTargets, transport])

  const createForwardTarget = React.useCallback(
    async ({
      pathMode,
      url,
    }: {
      pathMode?: EndpointForwardPathMode
      url: string
    }) => {
      if (!endpointId || isSavingForwardTargetRef.current) {
        return
      }

      const savingEndpointId = endpointId

      isSavingForwardTargetRef.current = true
      forwardTargetListVersion.current += 1
      setIsSavingForwardTarget(true)

      try {
        const target = await transport.createForwardTarget(savingEndpointId, {
          pathMode,
          url,
        })

        if (activeEndpointIdRef.current === savingEndpointId) {
          setForwardTargets((current) => mergeForwardTarget(current, target))
          setErrorMessage(null)
        }
      } catch (error) {
        if (activeEndpointIdRef.current === savingEndpointId) {
          setErrorMessage(readErrorMessage(error))
        }

        throw error
      } finally {
        if (activeEndpointIdRef.current === savingEndpointId) {
          isSavingForwardTargetRef.current = false
          setIsSavingForwardTarget(false)
        }
      }
    },
    [endpointId, transport]
  )

  const updateForwardTarget = React.useCallback(
    async (
      targetId: string,
      target: {
        enabled?: boolean
        pathMode?: EndpointForwardPathMode
        url?: string
      }
    ) => {
      if (!endpointId || isSavingForwardTargetRef.current) {
        return
      }

      const savingEndpointId = endpointId

      isSavingForwardTargetRef.current = true
      forwardTargetListVersion.current += 1
      setIsSavingForwardTarget(true)

      try {
        const nextTarget = await transport.updateForwardTarget(
          savingEndpointId,
          targetId,
          target
        )

        if (activeEndpointIdRef.current === savingEndpointId) {
          setForwardTargets((current) =>
            replaceForwardTarget(current, nextTarget)
          )
          setErrorMessage(null)
        }
      } catch (error) {
        if (activeEndpointIdRef.current === savingEndpointId) {
          setErrorMessage(readErrorMessage(error))
        }

        throw error
      } finally {
        if (activeEndpointIdRef.current === savingEndpointId) {
          isSavingForwardTargetRef.current = false
          setIsSavingForwardTarget(false)
        }
      }
    },
    [endpointId, transport]
  )

  const deleteForwardTarget = React.useCallback(
    async (targetId: string) => {
      if (!endpointId || isSavingForwardTargetRef.current) {
        return
      }

      const savingEndpointId = endpointId

      isSavingForwardTargetRef.current = true
      forwardTargetListVersion.current += 1
      setIsSavingForwardTarget(true)

      try {
        await transport.deleteForwardTarget(savingEndpointId, targetId)

        if (activeEndpointIdRef.current === savingEndpointId) {
          setForwardTargets((current) => removeForwardTarget(current, targetId))
          setErrorMessage(null)
        }
      } catch (error) {
        if (activeEndpointIdRef.current === savingEndpointId) {
          setErrorMessage(readErrorMessage(error))
        }

        throw error
      } finally {
        if (activeEndpointIdRef.current === savingEndpointId) {
          isSavingForwardTargetRef.current = false
          setIsSavingForwardTarget(false)
        }
      }
    },
    [endpointId, transport]
  )

  const replayRequest = React.useCallback(
    async (requestId: string) => {
      if (!endpointId || replayingRequestIdsRef.current.has(requestId)) {
        return
      }

      const replayingEndpointId = endpointId
      const pendingRequestIds = new Set(replayingRequestIdsRef.current).add(
        requestId
      )

      replayingRequestIdsRef.current = pendingRequestIds
      setReplayingRequestIds(pendingRequestIds)

      try {
        const replayedRequest = await transport.replayRequest(
          replayingEndpointId,
          requestId
        )

        if (activeEndpointIdRef.current === replayingEndpointId) {
          setRequestState((current) => {
            if (
              !requestMatchesSearch(replayedRequest, requestSearchRef.current)
            ) {
              return current
            }

            return {
              hasMoreRequests: current.hasMoreRequests,
              nextCursor: current.nextCursor,
              requests: mergeCapturedRequest(current.requests, replayedRequest),
              selectedId: replayedRequest.id,
            }
          })
          setErrorMessage(null)
        }
      } catch (error) {
        if (activeEndpointIdRef.current === replayingEndpointId) {
          setErrorMessage(readErrorMessage(error))
        }

        throw error
      } finally {
        setReplayingRequestIds(() => {
          const next = new Set(replayingRequestIdsRef.current)

          next.delete(requestId)
          replayingRequestIdsRef.current = next

          return next
        })
      }
    },
    [endpointId, transport]
  )

  const loadEndpointStats = React.useCallback(async () => {
    if (!endpointId) {
      return null
    }

    const loadingEndpointId = endpointId
    const stats = await transport.loadEndpointStats(loadingEndpointId)

    if (activeEndpointIdRef.current !== loadingEndpointId) {
      return null
    }

    return stats satisfies EndpointStats
  }, [endpointId, transport])

  const startNewEndpoint = React.useCallback(async () => {
    if (isLoading) {
      return
    }

    setIsLoading(true)

    try {
      await createEndpoint()
    } catch (error) {
      setErrorMessage(readErrorMessage(error))
      setIsLoading(false)
    }
  }, [createEndpoint, isLoading])

  const processEndpointRenameQueue = React.useCallback(
    (renamingEndpointId: string) => {
      const saveState =
        renameSaveStatesByEndpoint.current.get(renamingEndpointId)

      if (!saveState || saveState.isSaving) {
        return
      }

      saveState.isSaving = true

      void (async () => {
        try {
          while (saveState.pendingName !== null) {
            const name = saveState.pendingName
            saveState.pendingName = null

            try {
              const metadata = await transport.updateEndpointMetadata(
                renamingEndpointId,
                {
                  name,
                }
              )

              if (saveState.pendingName === null) {
                applyEndpointMetadata(metadata)

                if (activeEndpointIdRef.current === renamingEndpointId) {
                  setErrorMessage(null)
                }
              }
            } catch (error) {
              if (
                saveState.pendingName === null &&
                activeEndpointIdRef.current === renamingEndpointId
              ) {
                setErrorMessage(readErrorMessage(error))
              }
            }
          }
        } finally {
          saveState.isSaving = false

          if (saveState.pendingName === null) {
            renameSaveStatesByEndpoint.current.delete(renamingEndpointId)
          }
        }
      })()
    },
    [applyEndpointMetadata, transport]
  )

  const renameCurrentEndpoint = React.useCallback(
    (name: string) => {
      if (!endpointId) {
        return
      }

      const renamingEndpointId = endpointId
      const saveState = renameSaveStatesByEndpoint.current.get(
        renamingEndpointId
      ) ?? {
        isSaving: false,
        pendingName: null,
      }

      saveState.pendingName = name
      renameSaveStatesByEndpoint.current.set(renamingEndpointId, saveState)
      processEndpointRenameQueue(renamingEndpointId)
    },
    [endpointId, processEndpointRenameQueue]
  )

  const switchEndpoint = React.useCallback(
    (nextEndpointId: string) => {
      if (!nextEndpointId || nextEndpointId === endpointId || isLoading) {
        return
      }

      setIsLoading(true)
      rememberActiveEndpointId(nextEndpointId)
      updateEndpointId(nextEndpointId)
      setRequestState({
        hasMoreRequests: false,
        nextCursor: null,
        requests: [],
        selectedId: null,
      })
      setForwardTargets([])
      forwardTargetListVersion.current += 1
      replayingRequestIdsRef.current = new Set()
      setReplayingRequestIds(replayingRequestIdsRef.current)
      requestListVersion.current += 1
      resetRequestSearch()
      setIsLoadingOlderRequests(false)
      setIsLoadingForwardTargets(false)
      isSavingForwardTargetRef.current = false
      setIsSavingForwardTarget(false)
      setResponseConfig(DEFAULT_ENDPOINT_RESPONSE_CONFIG)
      setConnectionState("connecting")
      const requestIdsAtLoadStart = new Set<string>()
      const requestListVersionAtLoadStart = requestListVersion.current

      void (async () => {
        try {
          const [
            nextRequestPage,
            nextResponseConfig,
            nextForwardTargets,
            metadata,
          ] = await Promise.all([
            transport.loadRequests(nextEndpointId),
            transport.loadEndpointResponseConfig(nextEndpointId),
            transport.listForwardTargets(nextEndpointId),
            transport.loadEndpoint(nextEndpointId),
          ])

          if (activeEndpointIdRef.current !== nextEndpointId) {
            return
          }

          applyEndpointMetadata(metadata)
          applyLoadedRequests({
            requestListVersionAtLoadStart,
            page: nextRequestPage,
            requestIdsAtLoadStart,
          })
          setForwardTargets(nextForwardTargets)
          setResponseConfig(nextResponseConfig)
          setErrorMessage(null)
        } catch (error) {
          if (activeEndpointIdRef.current === nextEndpointId) {
            setErrorMessage(readErrorMessage(error))
          }
        } finally {
          if (activeEndpointIdRef.current === nextEndpointId) {
            setIsLoading(false)
          }
        }
      })()
    },
    [
      applyEndpointMetadata,
      applyLoadedRequests,
      isLoading,
      endpointId,
      rememberActiveEndpointId,
      resetRequestSearch,
      transport,
      updateEndpointId,
    ]
  )

  const saveResponseOverride = React.useCallback(
    async (override: EndpointResponseOverrideInput) => {
      if (!endpointId || isSavingResponse) {
        return
      }

      const savingEndpointId = endpointId

      setIsSavingResponse(true)

      try {
        const nextResponseConfig = await transport.saveEndpointResponseOverride(
          savingEndpointId,
          override
        )

        if (activeEndpointIdRef.current === savingEndpointId) {
          setResponseConfig(nextResponseConfig)
          setErrorMessage(null)
        }
      } catch (error) {
        if (activeEndpointIdRef.current === savingEndpointId) {
          setErrorMessage(readErrorMessage(error))
        }

        throw error
      } finally {
        setIsSavingResponse(false)
      }
    },
    [isSavingResponse, endpointId, transport]
  )

  const clearResponseOverride = React.useCallback(async () => {
    if (!endpointId || isSavingResponse) {
      return
    }

    const savingEndpointId = endpointId

    setIsSavingResponse(true)

    try {
      const nextResponseConfig =
        await transport.clearEndpointResponseOverride(savingEndpointId)

      if (activeEndpointIdRef.current === savingEndpointId) {
        setResponseConfig(nextResponseConfig)
        setErrorMessage(null)
      }
    } catch (error) {
      if (activeEndpointIdRef.current === savingEndpointId) {
        setErrorMessage(readErrorMessage(error))
      }

      throw error
    } finally {
      setIsSavingResponse(false)
    }
  }, [isSavingResponse, endpointId, transport])

  const selectCapturedRequest = React.useCallback((id: string) => {
    setRequestState((current) => ({
      ...current,
      selectedId: id,
    }))
  }, [])

  const actions = React.useMemo<EndpointActions>(
    () => ({
      clearEndpoint,
      clearResponseOverride,
      createForwardTarget,
      deleteForwardTarget,
      loadForwardTargets,
      loadEndpointStats,
      loadOlderRequests,
      renameEndpoint: renameCurrentEndpoint,
      refreshEndpoint,
      replayRequest,
      saveResponseOverride,
      searchRequests,
      selectRequest: selectCapturedRequest,
      startNewEndpoint,
      switchEndpoint,
      updateForwardTarget,
    }),
    [
      clearEndpoint,
      clearResponseOverride,
      createForwardTarget,
      deleteForwardTarget,
      loadForwardTargets,
      loadEndpointStats,
      loadOlderRequests,
      refreshEndpoint,
      renameCurrentEndpoint,
      replayRequest,
      saveResponseOverride,
      searchRequests,
      selectCapturedRequest,
      startNewEndpoint,
      switchEndpoint,
      updateForwardTarget,
    ]
  )

  return {
    actions,
    canRefresh: Boolean(endpointId) && !isLoading && !isClearing,
    connectionState,
    errorMessage,
    endpointNames,
    forwardTargets,
    hasMoreRequests,
    isClearing,
    isLoadingForwardTargets,
    isLoading,
    isLoadingOlderRequests,
    isReplayingSelectedRequest,
    isSavingForwardTarget,
    isSavingResponse,
    recentEndpointIds,
    responseConfig,
    requestSearch,
    requests,
    selectedRequest,
    endpointId,
  }
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Something went wrong."
}
