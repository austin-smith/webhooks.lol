import "server-only"

import {
  ClientClosedError,
  ClientOfflineError,
  ConnectionTimeoutError,
  DisconnectsClientError,
  ErrorReply,
  ReconnectStrategyError,
  SocketClosedUnexpectedlyError,
  SocketTimeoutError,
  TimeoutError,
  createClient,
} from "redis"

import { readRedisUrl } from "@webhooks-lol/webhooks-server/rate-limits/config"

const REDIS_CONNECT_TIMEOUT_MS = 2_000
const REDIS_RETRY_BASE_DELAY_MS = 250
const REDIS_RETRY_MAX_DELAY_MS = 5_000
const REDIS_LOG_DEDUPLICATION_MS = 1_000

export type RateLimitStore = {
  eval: (script: string, keys: string[], args: string[]) => Promise<unknown>
}

export type RedisRateLimitClient = {
  readonly isOpen: boolean
  readonly isReady: boolean
  connect: () => Promise<unknown>
  destroy: () => void
  eval: (
    script: string,
    options: {
      arguments: string[]
      keys: string[]
    }
  ) => Promise<unknown>
  on: {
    (
      event: "connect" | "end" | "ready" | "reconnecting",
      listener: () => void
    ): RedisRateLimitClient
    (event: "error", listener: (error: Error) => void): RedisRateLimitClient
  }
}

type RedisRateLimitStoreLogger = {
  info: (message: string, details: Record<string, unknown>) => void
  warn: (message: string, details: Record<string, unknown>) => void
}

type RedisRateLimitStoreOptions = {
  clientFactory?: () => RedisRateLimitClient
  logger?: RedisRateLimitStoreLogger
  now?: () => number
  random?: () => number
}

const globalForRedis = globalThis as typeof globalThis & {
  __webhooksLolRateLimitStore?: RateLimitStore
}

export class RateLimitStoreUnavailableError extends Error {
  readonly retryAfterSeconds: number

  constructor({
    cause,
    retryAfterSeconds = 1,
  }: {
    cause?: unknown
    retryAfterSeconds?: number
  } = {}) {
    super("Rate limit service temporarily unavailable.", { cause })
    this.name = "RateLimitStoreUnavailableError"
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds))
  }
}

export function isRateLimitStoreUnavailableError(
  error: unknown
): error is RateLimitStoreUnavailableError {
  return error instanceof RateLimitStoreUnavailableError
}

export function createRedisRateLimitStore({
  clientFactory = createRedisClient,
  logger = redisLogger,
  now = Date.now,
  random = Math.random,
}: RedisRateLimitStoreOptions = {}): RateLimitStore {
  let client: RedisRateLimitClient | undefined
  const clientGenerations = new WeakMap<RedisRateLimitClient, number>()
  let connection: Promise<RedisRateLimitClient> | undefined
  let failureCount = 0
  let failedGeneration: number | undefined
  let generation = 0
  let retryAtMs = 0
  let lastErrorLog:
    | {
        signature: string
        timeMs: number
      }
    | undefined

  const retryAfterSeconds = () =>
    Math.max(1, Math.ceil((retryAtMs - now()) / 1_000))

  const recordFailure = (
    failedClient: RedisRateLimitClient,
    failedClientGeneration: number,
    error: unknown
  ) => {
    if (client !== failedClient) {
      return
    }

    if (failedGeneration !== failedClientGeneration) {
      failedGeneration = failedClientGeneration
      failureCount += 1
      retryAtMs =
        now() + calculateRetryDelayMs(failureCount, Math.max(0, random()))
    }

    logConnectionError(error, failedClientGeneration)
  }

  const recordSuccess = (readyClient: RedisRateLimitClient) => {
    if (client !== readyClient) {
      return
    }

    failureCount = 0
    failedGeneration = undefined
    retryAtMs = 0
  }

  const logConnectionError = (
    error: unknown,
    failedClientGeneration: number
  ) => {
    const details = describeError(error)
    const signature = `${details.name}:${details.code ?? ""}:${details.message}`
    const timeMs = now()

    if (
      lastErrorLog?.signature === signature &&
      timeMs - lastErrorLog.timeMs < REDIS_LOG_DEDUPLICATION_MS
    ) {
      return
    }

    lastErrorLog = { signature, timeMs }
    logger.warn("Redis rate-limit connection unavailable.", {
      error: details,
      generation: failedClientGeneration,
      retryAfterSeconds: retryAfterSeconds(),
    })
  }

  const retireClient = (retiredClient: RedisRateLimitClient) => {
    if (client === retiredClient) {
      client = undefined
    }

    if (!retiredClient.isOpen) {
      return
    }

    try {
      retiredClient.destroy()
    } catch {
      // A concurrent socket error can close the client between the state check
      // and destroy. The client is already unusable in that case.
    }
  }

  const attachLifecycleListeners = (
    nextClient: RedisRateLimitClient,
    nextGeneration: number
  ) => {
    nextClient
      .on("connect", () => {
        logger.info("Redis rate-limit connection opened.", {
          generation: nextGeneration,
        })
      })
      .on("ready", () => {
        logger.info("Redis rate-limit connection ready.", {
          generation: nextGeneration,
        })
      })
      .on("reconnecting", () => {
        logger.info("Redis rate-limit connection reconnecting.", {
          generation: nextGeneration,
        })
      })
      .on("end", () => {
        logger.info("Redis rate-limit connection ended.", {
          generation: nextGeneration,
        })
      })
      .on("error", (error) => {
        recordFailure(nextClient, nextGeneration, error)
      })
  }

  const connectClient = (
    nextClient: RedisRateLimitClient,
    nextGeneration: number
  ) => {
    const pendingConnection = (async () => {
      try {
        await nextClient.connect()

        if (!nextClient.isReady) {
          throw new ClientOfflineError()
        }

        return nextClient
      } catch (error) {
        recordFailure(nextClient, nextGeneration, error)
        retireClient(nextClient)

        throw new RateLimitStoreUnavailableError({
          cause: error,
          retryAfterSeconds: retryAfterSeconds(),
        })
      }
    })()

    connection = pendingConnection

    const clearPendingConnection = () => {
      if (connection === pendingConnection) {
        connection = undefined
      }
    }

    void pendingConnection.then(
      clearPendingConnection,
      clearPendingConnection
    )

    return pendingConnection
  }

  const getReadyClient = async () => {
    if (client?.isReady) {
      return client
    }

    if (connection) {
      return connection
    }

    if (now() < retryAtMs) {
      throw new RateLimitStoreUnavailableError({
        retryAfterSeconds: retryAfterSeconds(),
      })
    }

    if (client) {
      retireClient(client)
    }

    const nextGeneration = generation + 1
    generation = nextGeneration

    const nextClient = clientFactory()
    client = nextClient
    clientGenerations.set(nextClient, nextGeneration)
    attachLifecycleListeners(nextClient, nextGeneration)

    return connectClient(nextClient, nextGeneration)
  }

  return {
    async eval(script, keys, args) {
      const readyClient = await getReadyClient()

      try {
        const result = await readyClient.eval(script, {
          arguments: args,
          keys,
        })

        recordSuccess(readyClient)
        return result
      } catch (error) {
        if (!isRedisAvailabilityError(error)) {
          throw error
        }

        recordFailure(
          readyClient,
          clientGenerations.get(readyClient) ?? generation,
          error
        )
        retireClient(readyClient)

        throw new RateLimitStoreUnavailableError({
          cause: error,
          retryAfterSeconds: retryAfterSeconds(),
        })
      }
    },
  }
}

export function getRateLimitStore() {
  if (!globalForRedis.__webhooksLolRateLimitStore) {
    globalForRedis.__webhooksLolRateLimitStore = createRedisRateLimitStore()
  }

  return globalForRedis.__webhooksLolRateLimitStore
}

export function setRateLimitStoreForTesting(store: RateLimitStore | null) {
  globalForRedis.__webhooksLolRateLimitStore = store ?? undefined
}

function createRedisClient(): RedisRateLimitClient {
  return createClient({
    disableOfflineQueue: true,
    socket: {
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      reconnectStrategy: false,
    },
    url: readRedisUrl(),
  })
}

function calculateRetryDelayMs(failure: number, random: number) {
  const exponentialDelay = Math.min(
    REDIS_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, failure - 1),
    REDIS_RETRY_MAX_DELAY_MS
  )
  const jitter = Math.floor(Math.min(random, 1) * REDIS_RETRY_BASE_DELAY_MS)

  return Math.min(exponentialDelay + jitter, REDIS_RETRY_MAX_DELAY_MS)
}

function isRedisAvailabilityError(error: unknown) {
  if (
    error instanceof ClientClosedError ||
    error instanceof ClientOfflineError ||
    error instanceof ConnectionTimeoutError ||
    error instanceof DisconnectsClientError ||
    error instanceof ReconnectStrategyError ||
    error instanceof SocketClosedUnexpectedlyError ||
    error instanceof SocketTimeoutError ||
    error instanceof TimeoutError
  ) {
    return true
  }

  if (error instanceof ErrorReply) {
    return /^(BUSY|CLUSTERDOWN|LOADING|MASTERDOWN|READONLY|TRYAGAIN)\b/.test(
      error.message
    )
  }

  const code = readErrorCode(error)

  return (
    code === "EAI_AGAIN" ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "ENETUNREACH" ||
    code === "ENOTFOUND" ||
    code === "EPIPE" ||
    code === "ETIMEDOUT"
  )
}

function describeError(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      code: undefined,
      message: String(error),
      name: "UnknownError",
    }
  }

  return {
    code: readErrorCode(error),
    message: error.message,
    name: error.name,
  }
}

function readErrorCode(error: unknown) {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    typeof error.code !== "string"
  ) {
    return undefined
  }

  return error.code
}

const redisLogger: RedisRateLimitStoreLogger = {
  info(message, details) {
    console.info(`[rate-limit-store] ${message}`, details)
  },
  warn(message, details) {
    console.warn(`[rate-limit-store] ${message}`, details)
  },
}
