import "server-only"

import { readCookieValue, serializeCookie } from "@/lib/cookies"

export const ANONYMOUS_ENDPOINT_SESSION_COOKIE = "webhooks_lol_endpoint_session"

const ENDPOINT_SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type AnonymousEndpointSession = {
  id: string
  setCookie: string | null
}

export function getAnonymousEndpointSession(
  request: Request
): AnonymousEndpointSession {
  const existingSessionId = getAnonymousEndpointSessionId(request)

  if (existingSessionId) {
    return {
      id: existingSessionId,
      setCookie: null,
    }
  }

  const id = crypto.randomUUID()

  return {
    id,
    setCookie: serializeAnonymousEndpointSessionCookie(id),
  }
}

export function getAnonymousEndpointSessionId(request: Request) {
  const existingSessionId = readCookieValue(
    request.headers.get("cookie"),
    ANONYMOUS_ENDPOINT_SESSION_COOKIE
  )

  return existingSessionId && UUID_PATTERN.test(existingSessionId)
    ? existingSessionId
    : null
}

function serializeAnonymousEndpointSessionCookie(sessionId: string) {
  return serializeCookie(ANONYMOUS_ENDPOINT_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    maxAgeSeconds: ENDPOINT_SESSION_COOKIE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  })
}
