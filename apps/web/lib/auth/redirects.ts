const DEFAULT_AUTH_REDIRECT_PATH = "/"
export const EMAIL_VERIFICATION_CALLBACK_PATH = "/email-verified"
export const FORGOT_PASSWORD_PATH = "/forgot-password"
export const RESET_PASSWORD_PATH = "/reset-password"

export function resolveAuthRedirectPath(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value

  if (!rawValue) {
    return DEFAULT_AUTH_REDIRECT_PATH
  }

  if (!rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT_PATH
  }

  if (rawValue.startsWith("/api/auth")) {
    return DEFAULT_AUTH_REDIRECT_PATH
  }

  return rawValue
}
