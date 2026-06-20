export const SIGN_IN_AUTH_FAILED_MESSAGE = "Invalid email or password."

type SignInAuthError = {
  code?: string
  message?: string
}

export function getSignInFailureMessage(error?: SignInAuthError) {
  void error

  return SIGN_IN_AUTH_FAILED_MESSAGE
}
