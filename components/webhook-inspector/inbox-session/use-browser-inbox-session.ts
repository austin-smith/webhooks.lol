"use client"

import * as React from "react"

import type { CapturedRequest } from "@/lib/webhooks/types"

import type {
  ConnectionState,
  InboxActions,
  InboxNames,
  WebhookInbox,
} from "../types"
import { createBrowserInboxEventStream } from "./event-stream"
import {
  mergeCapturedRequest,
  rememberInboxToken,
  reconcileLoadedRequests,
  renameInbox,
  selectRequest,
  selectRequestId,
} from "./state"
import { createBrowserInboxSessionStorage } from "./storage"
import { createFetchInboxTransport } from "./transport"

export function useBrowserInboxSession(): WebhookInbox {
  const storage = React.useMemo(() => createBrowserInboxSessionStorage(), [])
  const transport = React.useMemo(() => createFetchInboxTransport(), [])
  const eventStream = React.useMemo(() => createBrowserInboxEventStream(), [])
  const hasLoadedStorage = React.useRef(false)
  const activeTokenRef = React.useRef<string | null>(null)
  const clearVersion = React.useRef(0)
  const [token, setToken] = React.useState<string | null>(null)
  const [inboxNames, setInboxNames] = React.useState<InboxNames>({})
  const [recentTokens, setRecentTokens] = React.useState<string[]>([])
  const [requestState, setRequestState] = React.useState<{
    requests: CapturedRequest[]
    selectedId: string | null
  }>({
    requests: [],
    selectedId: null,
  })
  const [isLoading, setIsLoading] = React.useState(true)
  const [isClearing, setIsClearing] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [connectionState, setConnectionState] =
    React.useState<ConnectionState>("connecting")
  const { requests, selectedId } = requestState

  const selectedRequest = selectRequest(requests, selectedId)

  const updateToken = React.useCallback((nextToken: string) => {
    activeTokenRef.current = nextToken
    setToken(nextToken)
  }, [])

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

  const rememberToken = React.useCallback((nextToken: string) => {
    setRecentTokens((current) => rememberInboxToken(nextToken, current))
  }, [])

  const applyNewInbox = React.useCallback(
    (nextToken: string) => {
      hasLoadedStorage.current = true
      rememberToken(nextToken)
      updateToken(nextToken)
      setRequestState({ requests: [], selectedId: null })
      setErrorMessage(null)
      setConnectionState("connecting")
      setIsLoading(false)
    },
    [rememberToken, updateToken]
  )

  const createInbox = React.useCallback(async () => {
    const nextToken = await transport.createInbox()

    applyNewInbox(nextToken)
  }, [applyNewInbox, transport])

  React.useEffect(() => {
    let isActive = true

    queueMicrotask(() => {
      if (!isActive) {
        return
      }

      const storedSession = storage.read()
      const activeToken = storedSession.activeToken

      hasLoadedStorage.current = true
      setInboxNames(storedSession.inboxNames)
      setRecentTokens(storedSession.recentTokens)

      if (activeToken) {
        // Reveal the restored inbox identity (URL, switcher label, live
        // connection) immediately so a refresh does not flash placeholders.
        // Only the captured-request list waits on the network.
        updateToken(activeToken)
        const requestIdsAtLoadStart = new Set<string>()
        const clearVersionAtLoadStart = clearVersion.current

        void (async () => {
          try {
            const nextRequests = await transport.loadRequests(activeToken)

            if (!isActive || activeTokenRef.current !== activeToken) {
              return
            }

            applyLoadedRequests({
              clearVersionAtLoadStart,
              loadedRequests: nextRequests,
              requestIdsAtLoadStart,
            })
            setErrorMessage(null)
          } catch (error) {
            if (isActive && activeTokenRef.current === activeToken) {
              setErrorMessage(readErrorMessage(error))
            }
          } finally {
            if (isActive && activeTokenRef.current === activeToken) {
              setIsLoading(false)
            }
          }
        })()

        return
      }

      void (async () => {
        try {
          const nextToken = await transport.createInbox()

          if (isActive) {
            applyNewInbox(nextToken)
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
  }, [applyLoadedRequests, applyNewInbox, storage, transport, updateToken])

  React.useEffect(() => {
    if (!hasLoadedStorage.current || !token) {
      return
    }

    storage.writeActiveToken(token)
  }, [storage, token])

  React.useEffect(() => {
    if (!hasLoadedStorage.current) {
      return
    }

    storage.writeRecentTokens(recentTokens)
  }, [recentTokens, storage])

  React.useEffect(() => {
    if (!hasLoadedStorage.current) {
      return
    }

    storage.writeInboxNames(inboxNames, recentTokens)
  }, [inboxNames, recentTokens, storage])

  React.useEffect(() => {
    if (!token) {
      return
    }

    return eventStream.subscribe(token, {
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
  }, [eventStream, token])

  const refreshInbox = React.useCallback(async () => {
    if (!token) {
      return
    }

    const requestIdsAtLoadStart = new Set(requests.map((request) => request.id))
    const clearVersionAtLoadStart = clearVersion.current
    const loadingToken = token

    try {
      const nextRequests = await transport.loadRequests(loadingToken)

      if (activeTokenRef.current !== loadingToken) {
        return
      }

      applyLoadedRequests({
        clearVersionAtLoadStart,
        loadedRequests: nextRequests,
        requestIdsAtLoadStart,
      })
      setErrorMessage(null)
    } catch (error) {
      if (activeTokenRef.current === loadingToken) {
        setErrorMessage(readErrorMessage(error))
      }
    }
  }, [applyLoadedRequests, requests, token, transport])

  const clearInbox = React.useCallback(async () => {
    if (!token || isClearing) {
      return
    }

    setIsClearing(true)

    try {
      await transport.clearInbox(token)
      clearVersion.current += 1
      setRequestState({ requests: [], selectedId: null })
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(readErrorMessage(error))
    } finally {
      setIsClearing(false)
    }
  }, [isClearing, token, transport])

  const startNewInbox = React.useCallback(async () => {
    if (isLoading) {
      return
    }

    setIsLoading(true)

    try {
      await createInbox()
    } catch (error) {
      setErrorMessage(readErrorMessage(error))
      setIsLoading(false)
    }
  }, [createInbox, isLoading])

  const renameCurrentInbox = React.useCallback(
    (name: string) => {
      if (!token) {
        return
      }

      setInboxNames((currentNames) =>
        renameInbox({
          currentNames,
          name,
          recentTokens,
          token,
        })
      )
    },
    [recentTokens, token]
  )

  const switchInbox = React.useCallback(
    (nextToken: string) => {
      if (!nextToken || nextToken === token || isLoading) {
        return
      }

      setIsLoading(true)
      updateToken(nextToken)
      setRequestState({ requests: [], selectedId: null })
      setConnectionState("connecting")
      const requestIdsAtLoadStart = new Set<string>()
      const clearVersionAtLoadStart = clearVersion.current

      void (async () => {
        try {
          const nextRequests = await transport.loadRequests(nextToken)

          if (activeTokenRef.current !== nextToken) {
            return
          }

          applyLoadedRequests({
            clearVersionAtLoadStart,
            loadedRequests: nextRequests,
            requestIdsAtLoadStart,
          })
          setErrorMessage(null)
        } catch (error) {
          if (activeTokenRef.current === nextToken) {
            setErrorMessage(readErrorMessage(error))
          }
        } finally {
          if (activeTokenRef.current === nextToken) {
            setIsLoading(false)
          }
        }
      })()
    },
    [applyLoadedRequests, isLoading, token, transport, updateToken]
  )

  const selectCapturedRequest = React.useCallback((id: string) => {
    setRequestState((current) => ({
      ...current,
      selectedId: id,
    }))
  }, [])

  const actions = React.useMemo<InboxActions>(
    () => ({
      clearInbox,
      renameInbox: renameCurrentInbox,
      refreshInbox,
      selectRequest: selectCapturedRequest,
      startNewInbox,
      switchInbox,
    }),
    [
      clearInbox,
      refreshInbox,
      renameCurrentInbox,
      selectCapturedRequest,
      startNewInbox,
      switchInbox,
    ]
  )

  return {
    actions,
    canRefresh: Boolean(token) && !isLoading && !isClearing,
    connectionState,
    errorMessage,
    inboxNames,
    isClearing,
    isLoading,
    recentTokens,
    requests,
    selectedRequest,
    token,
  }
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Something went wrong."
}
