import { describe, expect, it, vi } from "vitest"

import { enforceClosedSignupPolicy } from "@/lib/auth/signup-policy"

function createDatabaseWithUserCount(userCount: number) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(async () => [{ value: userCount }]),
    })),
  }
}

describe("enforceClosedSignupPolicy", () => {
  it("allows the first user creation", async () => {
    await expect(
      enforceClosedSignupPolicy(createDatabaseWithUserCount(0) as never)
    ).resolves.toBe(true)
  })

  it("blocks new user creation after the first user exists", async () => {
    await expect(
      enforceClosedSignupPolicy(createDatabaseWithUserCount(1) as never)
    ).resolves.toBe(false)
  })
})
