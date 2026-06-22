import { describe, expect, it } from "vitest"

import { handleAuthBeforeHook } from "@/lib/auth/hooks"

describe("auth hooks", () => {
  it("ignores unrelated Better Auth endpoints", async () => {
    await expect(
      handleAuthBeforeHook({
        body: {
          image: " ",
          name: " Person Example ",
        },
        context: {},
        path: "/sign-out",
      })
    ).resolves.toBeUndefined()
  })

  it("normalizes Better Auth user updates before persistence", async () => {
    await expect(
      handleAuthBeforeHook({
        body: {
          image: " ",
          name: " Person Example ",
        },
        context: {},
        path: "/update-user",
      })
    ).resolves.toMatchObject({
      context: {
        body: {
          image: null,
          name: "Person Example",
        },
      },
    })
  })

  it("rejects invalid Better Auth user updates", async () => {
    await expect(
      handleAuthBeforeHook({
        body: {
          image: "javascript:alert(1)",
          name: "Person Example",
        },
        context: {},
        path: "/update-user",
      })
    ).rejects.toThrow("Avatar URL must use HTTPS.")
  })

  it("rejects unsupported Better Auth user update fields", async () => {
    await expect(
      handleAuthBeforeHook({
        body: {
          name: "Person Example",
          role: "admin",
        },
        context: {},
        path: "/update-user",
      })
    ).rejects.toThrow("Only name and avatar can be updated here.")
  })
})
