import "server-only"

import { createClient } from "redis"

import { readRedisUrl } from "@/lib/rate-limits/config"

export type RateLimitStore = {
  eval: (script: string, keys: string[], args: string[]) => Promise<unknown>
}

type RedisClient = {
  eval: (
    script: string,
    options: {
      arguments: string[]
      keys: string[]
    }
  ) => Promise<unknown>
}

const globalForRedis = globalThis as typeof globalThis & {
  __webhooksLolRedisClient?: Promise<RedisClient>
  __webhooksLolRateLimitStore?: RateLimitStore
}

export async function getRateLimitStore() {
  if (globalForRedis.__webhooksLolRateLimitStore) {
    return globalForRedis.__webhooksLolRateLimitStore
  }

  const client = await getRedisClient()

  return {
    async eval(script, keys, args) {
      return client.eval(script, {
        arguments: args,
        keys,
      })
    },
  } satisfies RateLimitStore
}

export function setRateLimitStoreForTesting(store: RateLimitStore | null) {
  globalForRedis.__webhooksLolRateLimitStore = store ?? undefined
}

async function getRedisClient() {
  if (!globalForRedis.__webhooksLolRedisClient) {
    globalForRedis.__webhooksLolRedisClient = createConnectedRedisClient()
  }

  return globalForRedis.__webhooksLolRedisClient
}

async function createConnectedRedisClient() {
  const client = createClient({
    url: readRedisUrl(),
  }) as RedisClient & {
    connect: () => Promise<unknown>
  }

  await client.connect()

  return client
}
