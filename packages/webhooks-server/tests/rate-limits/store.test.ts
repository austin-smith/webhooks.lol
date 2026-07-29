import { EventEmitter } from "node:events"

import {
  ConnectionTimeoutError,
  DisconnectsClientError,
  ErrorReply,
  SocketClosedUnexpectedlyError,
} from "redis"
import { describe, expect, it, vi } from "vitest"

import {
  createRedisRateLimitStore,
  RateLimitStoreUnavailableError,
  type RedisRateLimitClient,
} from "@webhooks-lol/webhooks-server/rate-limits/store"

const SCRIPT = "return 1"
const KEYS = ["rate-limit:test"]
const ARGS = ["1"]

const silentLogger = {
  info: vi.fn(),
  warn: vi.fn(),
}

class FakeRedisClient extends EventEmitter {
  isOpen = false
  isReady = false

  readonly connect = vi.fn(async () => {
    this.isOpen = true
    this.emit("connect")
    await this.connectImplementation()
    this.isReady = true
    this.emit("ready")
  })

  readonly destroy = vi.fn(() => {
    this.isOpen = false
    this.isReady = false
    this.emit("end")
  })

  readonly eval = vi.fn(
    async (
      script: string,
      options: {
        arguments: string[]
        keys: string[]
      }
    ) => this.evalImplementation(script, options)
  )

  constructor(
    private readonly evalImplementation: (
      script: string,
      options: {
        arguments: string[]
        keys: string[]
      }
    ) => Promise<unknown> = async () => 1,
    private readonly connectImplementation: () => Promise<void> = async () => {}
  ) {
    super()
  }
}

function asRateLimitClient(client: FakeRedisClient) {
  return client as RedisRateLimitClient
}

describe("Redis rate-limit store", () => {
  it("reuses one ready client for subsequent commands", async () => {
    const client = new FakeRedisClient()
    const clientFactory = vi.fn(() => asRateLimitClient(client))
    const store = createRedisRateLimitStore({
      clientFactory,
      logger: silentLogger,
    })

    await expect(store.eval(SCRIPT, KEYS, ARGS)).resolves.toBe(1)
    await expect(store.eval(SCRIPT, KEYS, ARGS)).resolves.toBe(1)

    expect(clientFactory).toHaveBeenCalledOnce()
    expect(client.connect).toHaveBeenCalledOnce()
    expect(client.eval).toHaveBeenCalledTimes(2)
    expect(client.eval).toHaveBeenCalledWith(SCRIPT, {
      arguments: ARGS,
      keys: KEYS,
    })
  })

  it("deduplicates concurrent connection attempts", async () => {
    let finishConnect: (() => void) | undefined
    const connected = new Promise<void>((resolve) => {
      finishConnect = resolve
    })
    const client = new FakeRedisClient(
      async () => 1,
      async () => connected
    )
    const clientFactory = vi.fn(() => asRateLimitClient(client))
    const store = createRedisRateLimitStore({
      clientFactory,
      logger: silentLogger,
    })

    const firstCommand = store.eval(SCRIPT, KEYS, ARGS)
    const secondCommand = store.eval(SCRIPT, KEYS, ARGS)

    expect(clientFactory).toHaveBeenCalledOnce()
    expect(client.connect).toHaveBeenCalledOnce()

    finishConnect?.()

    await expect(Promise.all([firstCommand, secondCommand])).resolves.toEqual([
      1, 1,
    ])
    expect(client.eval).toHaveBeenCalledTimes(2)
  })

  it("rotates clients after an initial connection failure and cooldown", async () => {
    let timeMs = 0
    const failedClient = new FakeRedisClient(
      async () => 1,
      async () => {
        throw new ConnectionTimeoutError()
      }
    )
    const recoveredClient = new FakeRedisClient(async () => 2)
    const clients = [failedClient, recoveredClient]
    const clientFactory = vi.fn(() =>
      asRateLimitClient(clients.shift() ?? recoveredClient)
    )
    const store = createRedisRateLimitStore({
      clientFactory,
      logger: silentLogger,
      now: () => timeMs,
      random: () => 0,
    })

    await expect(store.eval(SCRIPT, KEYS, ARGS)).rejects.toBeInstanceOf(
      RateLimitStoreUnavailableError
    )
    expect(failedClient.connect).toHaveBeenCalledOnce()
    expect(failedClient.eval).not.toHaveBeenCalled()
    expect(failedClient.destroy).toHaveBeenCalledOnce()

    await expect(store.eval(SCRIPT, KEYS, ARGS)).rejects.toBeInstanceOf(
      RateLimitStoreUnavailableError
    )
    expect(clientFactory).toHaveBeenCalledOnce()

    timeMs = 250

    await expect(store.eval(SCRIPT, KEYS, ARGS)).resolves.toBe(2)
    expect(clientFactory).toHaveBeenCalledTimes(2)
    expect(recoveredClient.connect).toHaveBeenCalledOnce()
    expect(recoveredClient.eval).toHaveBeenCalledOnce()
  })

  it("never replays a failed mutating command and rotates after cooldown", async () => {
    let timeMs = 0
    const connectionError = new SocketClosedUnexpectedlyError()
    const failedClient = new FakeRedisClient(async () => {
      throw connectionError
    })
    const recoveredClient = new FakeRedisClient(async () => 2)
    const clients = [failedClient, recoveredClient]
    const clientFactory = vi.fn(() =>
      asRateLimitClient(clients.shift() ?? recoveredClient)
    )
    const store = createRedisRateLimitStore({
      clientFactory,
      logger: silentLogger,
      now: () => timeMs,
      random: () => 0,
    })

    await expect(store.eval(SCRIPT, KEYS, ARGS)).rejects.toBeInstanceOf(
      RateLimitStoreUnavailableError
    )
    expect(failedClient.eval).toHaveBeenCalledOnce()
    expect(failedClient.destroy).toHaveBeenCalledOnce()
    expect(recoveredClient.eval).not.toHaveBeenCalled()

    await expect(store.eval(SCRIPT, KEYS, ARGS)).rejects.toBeInstanceOf(
      RateLimitStoreUnavailableError
    )
    expect(clientFactory).toHaveBeenCalledOnce()

    timeMs = 250

    await expect(store.eval(SCRIPT, KEYS, ARGS)).resolves.toBe(2)
    expect(clientFactory).toHaveBeenCalledTimes(2)
    expect(failedClient.eval).toHaveBeenCalledOnce()
    expect(recoveredClient.eval).toHaveBeenCalledOnce()
  })

  it("backs off across ready clients until a command succeeds", async () => {
    let timeMs = 0
    const unavailableReply = new ErrorReply("LOADING Redis is loading")
    const firstClient = new FakeRedisClient(async () => {
      throw unavailableReply
    })
    const secondClient = new FakeRedisClient(async () => {
      throw unavailableReply
    })
    const recoveredClient = new FakeRedisClient(async () => 2)
    const clients = [firstClient, secondClient, recoveredClient]
    const clientFactory = vi.fn(() =>
      asRateLimitClient(clients.shift() ?? recoveredClient)
    )
    const store = createRedisRateLimitStore({
      clientFactory,
      logger: silentLogger,
      now: () => timeMs,
      random: () => 0,
    })

    await expect(store.eval(SCRIPT, KEYS, ARGS)).rejects.toBeInstanceOf(
      RateLimitStoreUnavailableError
    )

    timeMs = 250

    await expect(store.eval(SCRIPT, KEYS, ARGS)).rejects.toBeInstanceOf(
      RateLimitStoreUnavailableError
    )

    timeMs = 500

    await expect(store.eval(SCRIPT, KEYS, ARGS)).rejects.toBeInstanceOf(
      RateLimitStoreUnavailableError
    )
    expect(clientFactory).toHaveBeenCalledTimes(2)

    timeMs = 750

    await expect(store.eval(SCRIPT, KEYS, ARGS)).resolves.toBe(2)
    expect(clientFactory).toHaveBeenCalledTimes(3)
  })

  it("normalizes commands disconnected while retiring a shared client", async () => {
    const pendingRejects: ((error: Error) => void)[] = []
    const client = new FakeRedisClient(
      () =>
        new Promise((_, reject) => {
          pendingRejects.push(reject)
        })
    )

    client.destroy.mockImplementation(() => {
      client.isOpen = false
      client.isReady = false

      for (const reject of pendingRejects.splice(0)) {
        reject(new DisconnectsClientError())
      }

      client.emit("end")
    })

    const store = createRedisRateLimitStore({
      clientFactory: () => asRateLimitClient(client),
      logger: silentLogger,
    })
    const firstCommand = store.eval(SCRIPT, KEYS, ARGS)
    const secondCommand = store.eval(SCRIPT, KEYS, ARGS)

    await vi.waitFor(() => {
      expect(client.eval).toHaveBeenCalledTimes(2)
    })

    const rejectFirstCommand = pendingRejects[0]

    expect(rejectFirstCommand).toBeDefined()
    rejectFirstCommand?.(new ErrorReply("TRYAGAIN Redis is busy"))

    const outcomes = await Promise.allSettled([firstCommand, secondCommand])

    for (const outcome of outcomes) {
      expect(outcome.status).toBe("rejected")

      if (outcome.status === "rejected") {
        expect(outcome.reason).toBeInstanceOf(RateLimitStoreUnavailableError)
      }
    }

    expect(client.destroy).toHaveBeenCalledOnce()
  })

  it("preserves non-availability Redis errors without rotating the client", async () => {
    const scriptError = new ErrorReply("ERR invalid rate-limit script")
    const client = new FakeRedisClient(async () => {
      throw scriptError
    })
    const clientFactory = vi.fn(() => asRateLimitClient(client))
    const store = createRedisRateLimitStore({
      clientFactory,
      logger: silentLogger,
    })

    await expect(store.eval(SCRIPT, KEYS, ARGS)).rejects.toBe(scriptError)

    expect(clientFactory).toHaveBeenCalledOnce()
    expect(client.destroy).not.toHaveBeenCalled()
  })

  it("attaches the required error listener before connecting", async () => {
    let errorListenerCount = 0
    const client = new FakeRedisClient(
      async () => 1,
      async () => {
        errorListenerCount = client.listenerCount("error")
      }
    )
    const store = createRedisRateLimitStore({
      clientFactory: () => asRateLimitClient(client),
      logger: silentLogger,
    })

    await store.eval(SCRIPT, KEYS, ARGS)

    expect(errorListenerCount).toBeGreaterThan(0)
  })
})
