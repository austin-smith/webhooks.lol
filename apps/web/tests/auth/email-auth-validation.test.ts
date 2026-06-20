import { describe, expect, it } from "vitest"

import { validateEmailAuthInput } from "@/lib/auth/email-auth-validation"
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/password-policy"

describe("email auth validation", () => {
  it("requires email and password", () => {
    expect(validateEmailAuthInput({ email: "", password: "" })).toEqual({
      email: "Email is required.",
      password: "Password is required.",
    })
  })

  it("requires a valid email address", () => {
    expect(
      validateEmailAuthInput({
        email: "owner",
        password: "password",
      })
    ).toEqual({
      email: "Enter a valid email address.",
    })
  })

  it("enforces the shared password length policy", () => {
    expect(
      validateEmailAuthInput({
        email: "owner@example.com",
        password: "x".repeat(MIN_PASSWORD_LENGTH - 1),
      })
    ).toEqual({
      password: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    })

    expect(
      validateEmailAuthInput({
        email: "owner@example.com",
        password: "x".repeat(MAX_PASSWORD_LENGTH + 1),
      })
    ).toEqual({
      password: "Password is too long.",
    })
  })

  it("accepts valid email auth input", () => {
    expect(
      validateEmailAuthInput({
        email: "owner@example.com",
        password: "x".repeat(MIN_PASSWORD_LENGTH),
      })
    ).toEqual({})
  })
})
