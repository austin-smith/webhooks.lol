import "server-only"

import { headers } from "next/headers"

import { getAuth } from "@/lib/auth/server"
import { requireUserSession } from "@/lib/auth/session"
import type { EndpointAccessActor } from "@webhooks-lol/webhooks-server/repository"

export async function getEndpointAccessActor(
  request?: Request
): Promise<EndpointAccessActor> {
  const requestHeaders = request?.headers ?? (await headers())

  if (!requestHeaders.has("cookie")) {
    return {
      userId: null,
    }
  }

  const session = await getAuth().api.getSession({
    headers: requestHeaders,
  })

  return {
    userId: session?.user.id ?? null,
  }
}

export async function requireEndpointUserId() {
  const session = await requireUserSession()

  return session.user.id
}
