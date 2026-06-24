import "server-only"

import { readAppUrl } from "@/lib/app-urls"

const DEFAULT_AUTH_REDIRECT_PATH = "/"
const AUTH_INTERNAL_PATH_PREFIX = "/api/auth"

export function resolveAuthRedirectPath(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value

  if (!rawValue) {
    return DEFAULT_AUTH_REDIRECT_PATH
  }

  const appUrl = readAppUrl()
  let redirectUrl: URL

  try {
    redirectUrl = new URL(rawValue, appUrl)
  } catch {
    return DEFAULT_AUTH_REDIRECT_PATH
  }

  if (redirectUrl.origin !== appUrl.origin) {
    return DEFAULT_AUTH_REDIRECT_PATH
  }

  const redirectPath = `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`

  if (redirectPath.startsWith(AUTH_INTERNAL_PATH_PREFIX)) {
    return DEFAULT_AUTH_REDIRECT_PATH
  }

  return redirectPath
}
