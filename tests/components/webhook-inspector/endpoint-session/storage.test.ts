import { describe, expect, it } from "vitest"

import { createEndpointSessionStorageAdapter } from "@/components/webhook-inspector/endpoint-session/storage"

const ACTIVE_ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"
const OLD_ENDPOINT_ID = "22222222-2222-4222-8222-222222222222"
const OTHER_ENDPOINT_ID = "33333333-3333-4333-8333-333333333333"

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

describe("endpoint session storage", () => {
  it("reads active webhook endpoint ID and recent webhook endpoint IDs as one session", () => {
    const memoryStorage = new MemoryStorage()
    const storage = createEndpointSessionStorageAdapter(() => memoryStorage)

    memoryStorage.setItem("webhooks.lol:endpoint-id", ACTIVE_ENDPOINT_ID)
    memoryStorage.setItem(
      "webhooks.lol:recent-endpoint-ids",
      JSON.stringify([OLD_ENDPOINT_ID])
    )

    expect(storage.read()).toEqual({
      activeEndpointId: ACTIVE_ENDPOINT_ID,
      recentEndpointIds: [ACTIVE_ENDPOINT_ID, OLD_ENDPOINT_ID],
    })
  })

  it("falls back to the first recent webhook endpoint ID when no active webhook endpoint ID exists", () => {
    const memoryStorage = new MemoryStorage()
    const storage = createEndpointSessionStorageAdapter(() => memoryStorage)

    memoryStorage.setItem(
      "webhooks.lol:recent-endpoint-ids",
      JSON.stringify([OLD_ENDPOINT_ID, OTHER_ENDPOINT_ID])
    )

    expect(storage.read()).toEqual({
      activeEndpointId: OLD_ENDPOINT_ID,
      recentEndpointIds: [OLD_ENDPOINT_ID, OTHER_ENDPOINT_ID],
    })
  })

  it("drops malformed stored endpoint IDs", () => {
    const memoryStorage = new MemoryStorage()
    const storage = createEndpointSessionStorageAdapter(() => memoryStorage)

    memoryStorage.setItem("webhooks.lol:endpoint-id", "not-an-endpoint")
    memoryStorage.setItem(
      "webhooks.lol:recent-endpoint-ids",
      JSON.stringify(["also-bad", OLD_ENDPOINT_ID])
    )

    expect(storage.read()).toEqual({
      activeEndpointId: OLD_ENDPOINT_ID,
      recentEndpointIds: [OLD_ENDPOINT_ID],
    })
  })

  it("writes normalized session values", () => {
    const memoryStorage = new MemoryStorage()
    const storage = createEndpointSessionStorageAdapter(() => memoryStorage)

    storage.writeActiveEndpointId(ACTIVE_ENDPOINT_ID)
    storage.writeRecentEndpointIds([
      ACTIVE_ENDPOINT_ID,
      ACTIVE_ENDPOINT_ID,
      OTHER_ENDPOINT_ID,
    ])

    expect(memoryStorage.getItem("webhooks.lol:endpoint-id")).toBe(
      ACTIVE_ENDPOINT_ID
    )
    expect(memoryStorage.getItem("webhooks.lol:recent-endpoint-ids")).toBe(
      JSON.stringify([ACTIVE_ENDPOINT_ID, OTHER_ENDPOINT_ID])
    )
  })
})
