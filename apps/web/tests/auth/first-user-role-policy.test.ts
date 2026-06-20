import { describe, expect, it, vi } from "vitest"

import { resolveRoleForNewUser } from "@/lib/auth/first-user-role-policy"

function createDatabaseWithUserCount(userCount: number) {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(() => ({
      from: vi.fn(async () => [{ value: userCount }]),
    })),
  }
}

describe("resolveRoleForNewUser", () => {
  it("assigns admin to the first user", async () => {
    const database = createDatabaseWithUserCount(0)

    await expect(resolveRoleForNewUser(database as never)).resolves.toBe(
      "admin"
    )

    expect(database.execute).toHaveBeenCalledOnce()
  })

  it("assigns standard user to later users", async () => {
    const database = createDatabaseWithUserCount(1)

    await expect(resolveRoleForNewUser(database as never)).resolves.toBe("user")

    expect(database.execute).toHaveBeenCalledOnce()
  })
})
