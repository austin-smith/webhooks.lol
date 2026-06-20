import { eq, sql } from "drizzle-orm"

import { user } from "@webhooks-lol/database/auth-schema"

import type { DrizzleDatabase } from "./types"

export const ADMIN_ROLE = "admin"
export const STANDARD_USER_ROLE = "user"

const ADMIN_ROLE_PATTERN = String.raw`(^|,)\s*admin\s*(,|$)`

export async function promoteUserToAdminIfNoAdminExists(
  database: DrizzleDatabase,
  userId: string
) {
  await database.transaction(async (transaction: DrizzleDatabase) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext('webhooks.lol:first-user-admin'))`
    )

    const [existingAdmin] = await transaction
      .select({ id: user.id })
      .from(user)
      .where(sql`${user.role} ~ ${ADMIN_ROLE_PATTERN}`)
      .limit(1)

    if (existingAdmin) {
      return
    }

    await transaction
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.id, userId))
  })
}
