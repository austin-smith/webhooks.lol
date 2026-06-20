import { describe, expect, it } from "vitest"

import {
  validateForgotPasswordInput,
  validatePasswordResetTokenInput,
} from "@/lib/auth/password-reset-validation"
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/password-policy"

describe("password reset validation", () => {
  it("requires an email address for forgot password", () => {
    expect(validateForgotPasswordInput({ email: "" })).toEqual({
      email: "Email is required.",
    })
  })

  it("requires a valid email address for forgot password", () => {
    expect(validateForgotPasswordInput({ email: "owner" })).toEqual({
      email: "Enter a valid email address.",
    })
  })

  it("accepts valid forgot password input", () => {
    expect(validateForgotPasswordInput({ email: "owner@example.com" })).toEqual(
      {}
    )
  })

  it("requires a new password and confirmation", () => {
    expect(
      validatePasswordResetTokenInput({
        confirmedPassword: "",
        newPassword: "",
      })
    ).toEqual({
      confirmedPassword: "Confirm your new password.",
      newPassword: "New password is required.",
    })
  })

  it("enforces the shared password length policy", () => {
    expect(
      validatePasswordResetTokenInput({
        confirmedPassword: "x".repeat(MIN_PASSWORD_LENGTH - 1),
        newPassword: "x".repeat(MIN_PASSWORD_LENGTH - 1),
      })
    ).toEqual({
      newPassword: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    })

    expect(
      validatePasswordResetTokenInput({
        confirmedPassword: "x".repeat(MAX_PASSWORD_LENGTH + 1),
        newPassword: "x".repeat(MAX_PASSWORD_LENGTH + 1),
      })
    ).toEqual({
      newPassword: "Password is too long.",
    })
  })

  it("requires matching password confirmation", () => {
    expect(
      validatePasswordResetTokenInput({
        confirmedPassword: "new-password-2",
        newPassword: "new-password-1",
      })
    ).toEqual({
      confirmedPassword: "Passwords do not match.",
    })
  })

  it("accepts valid reset password input", () => {
    expect(
      validatePasswordResetTokenInput({
        confirmedPassword: "new-password",
        newPassword: "new-password",
      })
    ).toEqual({})
  })
})
