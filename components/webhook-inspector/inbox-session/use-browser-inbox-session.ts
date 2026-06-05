"use client"

import * as React from "react"

import type { CapturedRequest } from "@/lib/webhook-types"

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
  const [token, setToken] = React.useState<string | null>(null)
  const [inboxNames, setInboxNames] = React.useState<InboxNames>({})
  const [recentTokens, setRecentTokens] = React.useState<string[]>([])
  const [requests, setRequests] = React.useState<CapturedRequest[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isClearing, setIsClearing] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [connectionState, setConnectionState] =
    React.useState<ConnectionState>("connecting")

  const selectedRequest = selectRequest(requests, selectedId)

  const applyRequests = React.useCallback((nextRequests: typeof requests) => {
    setRequests(nextRequests)
    setSelectedId((current) => selectRequestId(nextRequests, current))
  }, [])

  const rememberToken = React.useCallback((nextToken: string) => {
    setRecentTokens((current) => rememberInboxToken(nextToken, current))
  }, [])

  const applyNewInbox = React.useCallback(
    (nextToken: string) => {
      hasLoadedStorage.current = true
      rememberToken(nextToken)
      setToken(nextToken)
      setRequests([])
      setSelectedId(null)
      setErrorMessage(null)
      setConnectionState("connecting")
      setIsLoading(false)
    },
    [rememberToken]
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
        void (async () => {
          try {
            const nextRequests = await transport.loadRequests(activeToken)

            if (!isActive) {
              return
            }

            applyRequests(nextRequests)
            setErrorMessage(null)
          } catch (error) {
            if (isActive) {
              setErrorMessage(readErrorMessage(error))
            }
          } finally {
            if (isActive) {
              setToken(activeToken)
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
  }, [applyNewInbox, applyRequests, storage, transport])

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
        setRequests([])
        setSelectedId(null)
        setConnectionState("live")
      },
      onError() {
        setConnectionState("offline")
      },
      onReady() {
        setConnectionState("live")
      },
      onRequest(request) {
        setRequests((current) => mergeCapturedRequest(current, request))
        setSelectedId(request.id)
        setConnectionState("live")
      },
    })
  }, [eventStream, token])

  const refreshInbox = React.useCallback(async () => {
    if (!token) {
      return
    }

    try {
      const nextRequests = await transport.loadRequests(token)

      applyRequests(nextRequests)
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(readErrorMessage(error))
    }
  }, [applyRequests, token, transport])

  const clearInbox = React.useCallback(async () => {
    if (!token || isClearing) {
      return
    }

    setIsClearing(true)

    try {
      await transport.clearInbox(token)
      setRequests([])
      setSelectedId(null)
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
      setToken(nextToken)
      setRequests([])
      setSelectedId(null)
      setConnectionState("connecting")

      void (async () => {
        try {
          const nextRequests = await transport.loadRequests(nextToken)

          applyRequests(nextRequests)
          setErrorMessage(null)
        } catch (error) {
          setErrorMessage(readErrorMessage(error))
        } finally {
          setIsLoading(false)
        }
      })()
    },
    [applyRequests, isLoading, token, transport]
  )

  const actions = React.useMemo<InboxActions>(
    () => ({
      clearInbox,
      renameInbox: renameCurrentInbox,
      refreshInbox,
      selectRequest: setSelectedId,
      startNewInbox,
      switchInbox,
    }),
    [
      clearInbox,
      refreshInbox,
      renameCurrentInbox,
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
