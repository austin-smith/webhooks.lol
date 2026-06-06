import { afterEach, describe, expect, it, vi } from "vitest"

describe("auth server", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("does not require runtime auth configuration during module import", async () => {
    vi.resetModules()
    vi.stubEnv("DATABASE_URL", "")
    vi.stubEnv("GITHUB_CLIENT_ID", "")
    vi.stubEnv("GITHUB_CLIENT_SECRET", "")

    await expect(import("@/lib/auth/server")).resolves.toMatchObject({
      getAuth: expect.any(Function),
    })
  })
})
