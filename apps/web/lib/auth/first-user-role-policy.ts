import { count, sql } from "drizzle-orm"

import { user } from "@webhooks-lol/database/auth-schema"

import type { DrizzleDatabase } from "./types"

export const ADMIN_ROLE = "admin"
export const STANDARD_USER_ROLE = "user"

export async function resolveRoleForNewUser(database: DrizzleDatabase) {
  await database.execute(
    sql`select pg_advisory_xact_lock(hashtext('webhooks.lol:first-user-admin'))`
  )

  const [row] = await database.select({ value: count() }).from(user)

  return Number(row?.value ?? 0) === 0 ? ADMIN_ROLE : STANDARD_USER_ROLE
}
