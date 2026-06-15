import { count } from "drizzle-orm"

import { user } from "@webhooks-lol/database/auth-schema"

import type { DrizzleDatabase } from "./types"

export async function enforceClosedSignupPolicy(database: DrizzleDatabase) {
  const [row] = await database.select({ value: count() }).from(user)

  return Number(row?.value ?? 0) === 0
}
