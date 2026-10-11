import { afterAll, describe, expect, it, vi } from "vitest"

vi.hoisted(() => {
  vi.stubEnv("DATABASE_URL", "")
  vi.stubEnv("GITHUB_CLIENT_ID", "")
  vi.stubEnv("GITHUB_CLIENT_SECRET", "")
})

import * as authServer from "@/lib/auth/server"

afterAll(() => {
  vi.unstubAllEnvs()
})

describe("auth server", () => {
  it("does not require runtime auth configuration during module import", () => {
    expect(authServer.getAuth).toEqual(expect.any(Function))
  })
})
