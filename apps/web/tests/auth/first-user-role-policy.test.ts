import { describe, expect, it, vi } from "vitest"

import { promoteUserToAdminIfNoAdminExists } from "@/lib/auth/first-user-role-policy"

function createDatabase({ hasAdmin }: { hasAdmin: boolean }) {
  const transaction = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => (hasAdmin ? [{ id: "admin-user" }] : [])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  }

  return {
    transaction,
    database: {
      transaction: vi.fn(async (callback) => callback(transaction)),
    },
  }
}

describe("promoteUserToAdminIfNoAdminExists", () => {
  it("promotes the created user when no admin exists", async () => {
    const { database, transaction } = createDatabase({ hasAdmin: false })

    await expect(
      promoteUserToAdminIfNoAdminExists(database as never, "new-user")
    ).resolves.toBeUndefined()

    expect(database.transaction).toHaveBeenCalledOnce()
    expect(transaction.execute).toHaveBeenCalledOnce()
    expect(transaction.update).toHaveBeenCalledOnce()
  })

  it("leaves the created user as standard when an admin already exists", async () => {
    const { database, transaction } = createDatabase({ hasAdmin: true })

    await expect(
      promoteUserToAdminIfNoAdminExists(database as never, "new-user")
    ).resolves.toBeUndefined()

    expect(database.transaction).toHaveBeenCalledOnce()
    expect(transaction.execute).toHaveBeenCalledOnce()
    expect(transaction.update).not.toHaveBeenCalled()
  })

  it("holds the advisory lock for the promotion transaction", async () => {
    const { database, transaction } = createDatabase({ hasAdmin: false })

    await promoteUserToAdminIfNoAdminExists(database as never, "new-user")

    expect(transaction.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        queryChunks: expect.arrayContaining([
          expect.objectContaining({
            value: expect.arrayContaining([
              expect.stringContaining("pg_advisory_xact_lock"),
            ]),
          }),
        ]),
      })
    )
  })
})
