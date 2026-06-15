import "server-only"

import { eq, sql } from "drizzle-orm"

import { getDatabase } from "@webhooks-lol/database/client"
import { user } from "@webhooks-lol/database/auth-schema"

const ADMIN_ROLE = "admin"

export function hasBetterAuthAdminRole(role: string | null | undefined) {
  return parseBetterAuthRoles(role).includes(ADMIN_ROLE)
}

export async function getAdminRole(userId: string) {
  const [row] = await getDatabase()
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  return hasBetterAuthAdminRole(row?.role) ? ADMIN_ROLE : null
}

export function adminRoleSql() {
  return sql`${user.role} ~ '(^|,)\\s*admin\\s*(,|$)'`
}

function parseBetterAuthRoles(role: string | null | undefined) {
  return role
    ? role
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : []
}
