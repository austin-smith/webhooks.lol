import { describe, expect, it } from "vitest"

import { createEndpointSessionStorageAdapter } from "@/components/webhook-inspector/endpoint-session/storage"

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
  it("reads active webhook endpoint ID, recent webhook endpoint IDs, and names as one session", () => {
    const memoryStorage = new MemoryStorage()
    const storage = createEndpointSessionStorageAdapter(() => memoryStorage)

    memoryStorage.setItem("webhooks.lol:endpoint-id", "active")
    memoryStorage.setItem(
      "webhooks.lol:recent-endpoint-ids",
      JSON.stringify(["old"])
    )
    memoryStorage.setItem(
      "webhooks.lol:endpoint-names",
      JSON.stringify({
        active: "Active endpoint",
        old: "Old endpoint",
        unknown: "Ignored",
      })
    )

    expect(storage.read()).toEqual({
      activeEndpointId: "active",
      endpointNames: {
        active: "Active endpoint",
        old: "Old endpoint",
      },
      recentEndpointIds: ["active", "old"],
    })
  })

  it("falls back to the first recent webhook endpoint ID when no active webhook endpoint ID exists", () => {
    const memoryStorage = new MemoryStorage()
    const storage = createEndpointSessionStorageAdapter(() => memoryStorage)

    memoryStorage.setItem(
      "webhooks.lol:recent-endpoint-ids",
      JSON.stringify(["first", "second"])
    )

    expect(storage.read()).toEqual({
      activeEndpointId: "first",
      endpointNames: {},
      recentEndpointIds: ["first", "second"],
    })
  })

  it("writes normalized session values", () => {
    const memoryStorage = new MemoryStorage()
    const storage = createEndpointSessionStorageAdapter(() => memoryStorage)

    storage.writeActiveEndpointId("active")
    storage.writeRecentEndpointIds(["active", "active", "other"])
    storage.writeEndpointNames(
      {
        active: "Active endpoint",
        missing: "Ignored",
      },
      ["active"]
    )

    expect(memoryStorage.getItem("webhooks.lol:endpoint-id")).toBe("active")
    expect(memoryStorage.getItem("webhooks.lol:recent-endpoint-ids")).toBe(
      JSON.stringify(["active", "other"])
    )
    expect(memoryStorage.getItem("webhooks.lol:endpoint-names")).toBe(
      JSON.stringify({ active: "Active endpoint" })
    )
  })
})
