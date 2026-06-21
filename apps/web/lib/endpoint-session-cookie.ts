import "server-only"

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
  const existingSessionId = readCookie(
    request.headers.get("cookie"),
    ANONYMOUS_ENDPOINT_SESSION_COOKIE
  )

  if (existingSessionId && UUID_PATTERN.test(existingSessionId)) {
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

function readCookie(header: string | null, name: string) {
  if (!header) {
    return null
  }

  for (const part of header.split(";")) {
    const [rawName, ...rawValueParts] = part.trim().split("=")

    if (rawName !== name) {
      continue
    }

    const rawValue = rawValueParts.join("=")

    try {
      return decodeURIComponent(rawValue)
    } catch {
      return rawValue
    }
  }

  return null
}

function serializeAnonymousEndpointSessionCookie(sessionId: string) {
  const attributes = [
    `${ANONYMOUS_ENDPOINT_SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${ENDPOINT_SESSION_COOKIE_MAX_AGE_SECONDS}`,
  ]

  if (process.env.NODE_ENV === "production") {
    attributes.push("Secure")
  }

  return attributes.join("; ")
}
