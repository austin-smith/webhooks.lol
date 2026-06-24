export const EMAIL_VERIFICATION_CALLBACK_PATH = "/email-verified"
export const FORGOT_PASSWORD_PATH = "/forgot-password"
export const RESET_PASSWORD_PATH = "/reset-password"

export function authRedirectSavesEndpoint(callbackPath: string) {
  return new URLSearchParams(callbackPath.split("?")[1] ?? "").has(
    "saveEndpoint"
  )
}

export function createAuthRedirectHref(pathname: string, callbackPath: string) {
  if (callbackPath === "/") {
    return pathname
  }

  return `${pathname}?next=${encodeURIComponent(callbackPath)}`
}

export function createEmailVerificationCallbackPath(callbackPath: string) {
  return createAuthRedirectHref(EMAIL_VERIFICATION_CALLBACK_PATH, callbackPath)
}
