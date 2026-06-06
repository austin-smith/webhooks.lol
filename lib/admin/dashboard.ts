import "server-only"

import { count, desc } from "drizzle-orm"

import { getDatabase } from "@/lib/database/client"
import { adminRoleSql } from "@/lib/auth/authorization"
import { capturedRequests, endpoints, user } from "@/lib/database/schema"

export async function getAdminDashboardData() {
  const database = getDatabase()

  const [endpointCount, requestCount, userCount, adminCount, recentRequests] =
    await Promise.all([
      database.select({ value: count() }).from(endpoints),
      database.select({ value: count() }).from(capturedRequests),
      database.select({ value: count() }).from(user),
      database.select({ value: count() }).from(user).where(adminRoleSql()),
      database
        .select({
          id: capturedRequests.id,
          endpointId: capturedRequests.endpointId,
          method: capturedRequests.method,
          path: capturedRequests.path,
          contentType: capturedRequests.contentType,
          bodySize: capturedRequests.bodySize,
          ip: capturedRequests.ip,
          receivedAt: capturedRequests.receivedAt,
        })
        .from(capturedRequests)
        .orderBy(desc(capturedRequests.receivedAt))
        .limit(25),
    ])

  return {
    counts: {
      endpoints: Number(endpointCount[0]?.value ?? 0),
      requests: Number(requestCount[0]?.value ?? 0),
      users: Number(userCount[0]?.value ?? 0),
      admins: Number(adminCount[0]?.value ?? 0),
    },
    recentRequests,
  }
}
