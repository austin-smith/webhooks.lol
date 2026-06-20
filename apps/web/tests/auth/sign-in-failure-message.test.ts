import { describe, expect, it } from "vitest"

import {
  getSignInFailureMessage,
  SIGN_IN_AUTH_FAILED_MESSAGE,
} from "@/lib/auth/sign-in-failure-message"

describe("getSignInFailureMessage", () => {
  it("uses the generic credential failure message", () => {
    expect(getSignInFailureMessage()).toBe("Invalid email or password.")
    expect(SIGN_IN_AUTH_FAILED_MESSAGE).toBe("Invalid email or password.")
  })

  it("does not expose unverified account state", () => {
    expect(
      getSignInFailureMessage({
        code: "EMAIL_NOT_VERIFIED",
        message: "Email not verified",
      })
    ).toBe("Invalid email or password.")
  })

  it("does not expose raw provider sign-in failure details", () => {
    expect(
      getSignInFailureMessage({
        message: "Invalid password",
      })
    ).toBe("Invalid email or password.")
  })
})
