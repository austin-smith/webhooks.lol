import { describe, expect, it } from "vitest"

import { createInboxSessionStorageAdapter } from "@/components/webhook-inspector/inbox-session/storage"

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

describe("inbox session storage", () => {
  it("reads active token, recent tokens, and names as one session", () => {
    const memoryStorage = new MemoryStorage()
    const storage = createInboxSessionStorageAdapter(() => memoryStorage)

    memoryStorage.setItem("webhooks.lol:token", "active")
    memoryStorage.setItem("webhooks.lol:recent-tokens", JSON.stringify(["old"]))
    memoryStorage.setItem(
      "webhooks.lol:inbox-names",
      JSON.stringify({
        active: "Active inbox",
        old: "Old inbox",
        unknown: "Ignored",
      })
    )

    expect(storage.read()).toEqual({
      activeToken: "active",
      inboxNames: {
        active: "Active inbox",
        old: "Old inbox",
      },
      recentTokens: ["active", "old"],
    })
  })

  it("falls back to the first recent token when no active token exists", () => {
    const memoryStorage = new MemoryStorage()
    const storage = createInboxSessionStorageAdapter(() => memoryStorage)

    memoryStorage.setItem(
      "webhooks.lol:recent-tokens",
      JSON.stringify(["first", "second"])
    )

    expect(storage.read()).toEqual({
      activeToken: "first",
      inboxNames: {},
      recentTokens: ["first", "second"],
    })
  })

  it("writes normalized session values", () => {
    const memoryStorage = new MemoryStorage()
    const storage = createInboxSessionStorageAdapter(() => memoryStorage)

    storage.writeActiveToken("active")
    storage.writeRecentTokens(["active", "active", "other"])
    storage.writeInboxNames(
      {
        active: "Active inbox",
        missing: "Ignored",
      },
      ["active"]
    )

    expect(memoryStorage.getItem("webhooks.lol:token")).toBe("active")
    expect(memoryStorage.getItem("webhooks.lol:recent-tokens")).toBe(
      JSON.stringify(["active", "other"])
    )
    expect(memoryStorage.getItem("webhooks.lol:inbox-names")).toBe(
      JSON.stringify({ active: "Active inbox" })
    )
  })
})
