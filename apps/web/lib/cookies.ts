export function readCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null
  }

  for (const part of cookieHeader.split(";")) {
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

export function serializeCookie(
  name: string,
  value: string,
  {
    httpOnly = false,
    maxAgeSeconds,
    secure,
  }: {
    httpOnly?: boolean
    maxAgeSeconds: number
    secure: boolean
  }
) {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "SameSite=Lax",
  ]

  if (httpOnly) {
    attributes.push("HttpOnly")
  }

  if (secure) {
    attributes.push("Secure")
  }

  return attributes.join("; ")
}
