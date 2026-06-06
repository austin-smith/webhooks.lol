"use client"

import * as React from "react"

import {
  DEFAULT_ENDPOINT_RESPONSE_CONFIG,
  type EndpointResponseConfig,
  type EndpointResponseOverrideInput,
} from "@/lib/webhooks/endpoint-response"
import type { CapturedRequest } from "@/lib/webhooks/types"

import type {
  ConnectionState,
  EndpointActions,
  EndpointNames,
  Endpoint,
} from "../types"
import { createBrowserEndpointEventStream } from "./event-stream"
import {
  mergeCapturedRequest,
  rememberEndpointId,
  reconcileLoadedRequests,
  renameEndpoint,
  selectRequest,
  selectRequestId,
} from "./state"
import { createBrowserEndpointSessionStorage } from "./storage"
import { createFetchEndpointTransport } from "./transport"

export function useBrowserEndpointSession(): Endpoint {
  const storage = React.useMemo(
    () => createBrowserEndpointSessionStorage(),
    []
  )
  const transport = React.useMemo(
    () => createFetchEndpointTransport(),
    []
  )
  const eventStream = React.useMemo(
    () => createBrowserEndpointEventStream(),
    []
  )
  const hasLoadedStorage = React.useRef(false)
  const activeEndpointIdRef = React.useRef<string | null>(null)
  const clearVersion = React.useRef(0)
  const [endpointId, setEndpointId] = React.useState<
    string | null
  >(null)
  const [endpointNames, setEndpointNames] =
    React.useState<EndpointNames>({})
  const [recentEndpointIds, setRecentEndpointIds] =
    React.useState<string[]>([])
  const [requestState, setRequestState] = React.useState<{
    requests: CapturedRequest[]
    selectedId: string | null
  }>({
    requests: [],
    selectedId: null,
  })
  const [responseConfig, setResponseConfig] =
    React.useState<EndpointResponseConfig>(
      DEFAULT_ENDPOINT_RESPONSE_CONFIG
    )
  const [isLoading, setIsLoading] = React.useState(true)
  const [isClearing, setIsClearing] = React.useState(false)
  const [isSavingResponse, setIsSavingResponse] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [connectionState, setConnectionState] =
    React.useState<ConnectionState>("connecting")
  const { requests, selectedId } = requestState

  const selectedRequest = selectRequest(requests, selectedId)

  const updateEndpointId = React.useCallback(
    (nextEndpointId: string) => {
      activeEndpointIdRef.current = nextEndpointId
      setEndpointId(nextEndpointId)
    },
    []
  )

  const applyLoadedRequests = React.useCallback(
    ({
      clearVersionAtLoadStart,
      loadedRequests,
      requestIdsAtLoadStart,
    }: {
      clearVersionAtLoadStart: number
      loadedRequests: CapturedRequest[]
      requestIdsAtLoadStart: Set<string>
    }) => {
      setRequestState((current) => {
        if (clearVersion.current !== clearVersionAtLoadStart) {
          return current
        }

        const nextRequests = reconcileLoadedRequests({
          currentRequests: current.requests,
          loadedRequests,
          requestIdsAtLoadStart,
        })

        return {
          requests: nextRequests,
          selectedId: selectRequestId(nextRequests, current.selectedId),
        }
      })
    },
    []
  )

  const rememberActiveEndpointId = React.useCallback(
    (nextEndpointId: string) => {
      setRecentEndpointIds((current) =>
        rememberEndpointId(nextEndpointId, current)
      )
    },
    []
  )

  const applyNewEndpoint = React.useCallback(
    (nextEndpointId: string) => {
      hasLoadedStorage.current = true
      rememberActiveEndpointId(nextEndpointId)
      updateEndpointId(nextEndpointId)
      setRequestState({ requests: [], selectedId: null })
      setResponseConfig(DEFAULT_ENDPOINT_RESPONSE_CONFIG)
      setErrorMessage(null)
      setConnectionState("connecting")
      setIsLoading(false)
    },
    [rememberActiveEndpointId, updateEndpointId]
  )

  const createEndpoint = React.useCallback(async () => {
    const nextEndpointId = await transport.createEndpoint()

    applyNewEndpoint(nextEndpointId)
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
      setEndpointNames(storedSession.endpointNames)
      setRecentEndpointIds(storedSession.recentEndpointIds)

      if (activeEndpointId) {
        // Reveal the restored endpoint identity (URL, switcher label, live
        // connection) immediately so a refresh does not flash placeholders.
        // Only the captured-request list waits on the network.
        updateEndpointId(activeEndpointId)
        const requestIdsAtLoadStart = new Set<string>()
        const clearVersionAtLoadStart = clearVersion.current

        void (async () => {
          try {
            const [nextRequests, nextResponseConfig] = await Promise.all([
              transport.loadRequests(activeEndpointId),
              transport.loadEndpointResponseConfig(
                activeEndpointId
              ),
            ])

            if (
              !isActive ||
              activeEndpointIdRef.current !== activeEndpointId
            ) {
              return
            }

            applyLoadedRequests({
              clearVersionAtLoadStart,
              loadedRequests: nextRequests,
              requestIdsAtLoadStart,
            })
            setResponseConfig(nextResponseConfig)
            setErrorMessage(null)
          } catch (error) {
            if (
              isActive &&
              activeEndpointIdRef.current === activeEndpointId
            ) {
              setErrorMessage(readErrorMessage(error))
            }
          } finally {
            if (
              isActive &&
              activeEndpointIdRef.current === activeEndpointId
            ) {
              setIsLoading(false)
            }
          }
        })()

        return
      }

      void (async () => {
        try {
          const nextEndpointId = await transport.createEndpoint()

          if (isActive) {
            applyNewEndpoint(nextEndpointId)
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
    if (!hasLoadedStorage.current) {
      return
    }

    storage.writeEndpointNames(
      endpointNames,
      recentEndpointIds
    )
  }, [endpointNames, recentEndpointIds, storage])

  React.useEffect(() => {
    if (!endpointId) {
      return
    }

    return eventStream.subscribe(endpointId, {
      onClear() {
        clearVersion.current += 1
        setRequestState({ requests: [], selectedId: null })
        setConnectionState("live")
      },
      onError() {
        setConnectionState("offline")
      },
      onReady() {
        setConnectionState("live")
      },
      onRequest(request) {
        setRequestState((current) => ({
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
    const clearVersionAtLoadStart = clearVersion.current
    const loadingEndpointId = endpointId

    try {
      const nextRequests = await transport.loadRequests(
        loadingEndpointId
      )

      if (activeEndpointIdRef.current !== loadingEndpointId) {
        return
      }

      applyLoadedRequests({
        clearVersionAtLoadStart,
        loadedRequests: nextRequests,
        requestIdsAtLoadStart,
      })
      setErrorMessage(null)
    } catch (error) {
      if (activeEndpointIdRef.current === loadingEndpointId) {
        setErrorMessage(readErrorMessage(error))
      }
    }
  }, [applyLoadedRequests, requests, endpointId, transport])

  const clearEndpoint = React.useCallback(async () => {
    if (!endpointId || isClearing) {
      return
    }

    setIsClearing(true)

    try {
      await transport.clearEndpoint(endpointId)
      clearVersion.current += 1
      setRequestState({ requests: [], selectedId: null })
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(readErrorMessage(error))
    } finally {
      setIsClearing(false)
    }
  }, [isClearing, endpointId, transport])

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

  const renameCurrentEndpoint = React.useCallback(
    (name: string) => {
      if (!endpointId) {
        return
      }

      setEndpointNames((currentNames) =>
        renameEndpoint({
          currentNames,
          name,
          recentEndpointIds,
          endpointId,
        })
      )
    },
    [recentEndpointIds, endpointId]
  )

  const switchEndpoint = React.useCallback(
    (nextEndpointId: string) => {
      if (
        !nextEndpointId ||
        nextEndpointId === endpointId ||
        isLoading
      ) {
        return
      }

      setIsLoading(true)
      updateEndpointId(nextEndpointId)
      setRequestState({ requests: [], selectedId: null })
      setResponseConfig(DEFAULT_ENDPOINT_RESPONSE_CONFIG)
      setConnectionState("connecting")
      const requestIdsAtLoadStart = new Set<string>()
      const clearVersionAtLoadStart = clearVersion.current

      void (async () => {
        try {
          const [nextRequests, nextResponseConfig] = await Promise.all([
            transport.loadRequests(nextEndpointId),
            transport.loadEndpointResponseConfig(nextEndpointId),
          ])

          if (activeEndpointIdRef.current !== nextEndpointId) {
            return
          }

          applyLoadedRequests({
            clearVersionAtLoadStart,
            loadedRequests: nextRequests,
            requestIdsAtLoadStart,
          })
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
      applyLoadedRequests,
      isLoading,
      endpointId,
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
        const nextResponseConfig =
          await transport.saveEndpointResponseOverride(
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
        await transport.clearEndpointResponseOverride(
          savingEndpointId
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
      renameEndpoint: renameCurrentEndpoint,
      refreshEndpoint,
      saveResponseOverride,
      selectRequest: selectCapturedRequest,
      startNewEndpoint,
      switchEndpoint,
    }),
    [
      clearEndpoint,
      clearResponseOverride,
      refreshEndpoint,
      renameCurrentEndpoint,
      saveResponseOverride,
      selectCapturedRequest,
      startNewEndpoint,
      switchEndpoint,
    ]
  )

  return {
    actions,
    canRefresh: Boolean(endpointId) && !isLoading && !isClearing,
    connectionState,
    errorMessage,
    endpointNames,
    isClearing,
    isLoading,
    isSavingResponse,
    recentEndpointIds,
    responseConfig,
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
