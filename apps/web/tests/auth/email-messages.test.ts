import { describe, expect, it } from "vitest"

import {
  createPasswordResetNoticeEmailMessage,
  createResetPasswordEmailMessage,
  createVerifyEmailMessage,
} from "@/lib/auth/email-messages"

describe("email messages", () => {
  it("renders the verification email with branded html and plain text", async () => {
    const url = "https://webhooks.lol/verify?token=abc&next=%22home%22"

    const message = await createVerifyEmailMessage({
      to: "owner@example.com",
      url,
    })

    expect(message).toMatchObject({
      subject: "Verify your webhooks.lol email address",
      to: "owner@example.com",
    })
    expect(message.html).toContain("<!DOCTYPE html")
    expect(message.html).toContain("WEBHOOKS")
    expect(message.html).toContain(".LOL")
    expect(message.html).toContain("Verify your email address")
    expect(message.html).toContain("rgb(218,4,127)")
    expect(message.html).not.toContain("rgb(15,118,110)")
    expect(message.html).not.toContain("background-color:rgb(251,250,252)")
    expect(message.html).not.toContain("border-radius:6px")
    expect(message.html).toContain(
      "https://webhooks.lol/verify?token=abc&amp;next=%22home%22"
    )
    expect(message.html).toContain("style=")
    expect(normalizeRenderedText(message.text)).toContain(
      "verify your email address"
    )
    expect(message.text).toContain(url)
    expect(message.text).not.toContain(`Verify email address ${url}`)
  })

  it("renders the password reset email with branded html and plain text", async () => {
    const url = "https://webhooks.lol/reset-password?token=abc&next=%22home%22"

    const message = await createResetPasswordEmailMessage({
      to: "owner@example.com",
      url,
    })

    expect(message).toMatchObject({
      subject: "Reset your webhooks.lol password",
      to: "owner@example.com",
    })
    expect(message.html).toContain("<!DOCTYPE html")
    expect(message.html).toContain("Reset your password")
    expect(message.html).toContain("rgb(218,4,127)")
    expect(message.html).not.toContain("rgb(15,118,110)")
    expect(message.html).not.toContain("background-color:rgb(251,250,252)")
    expect(message.html).not.toContain("border-radius:6px")
    expect(message.html).toContain(
      "https://webhooks.lol/reset-password?token=abc&amp;next=%22home%22"
    )
    expect(message.html).toContain("style=")
    expect(normalizeRenderedText(message.text)).toContain("reset your password")
    expect(message.text).toContain(url)
    expect(message.text).not.toContain(`Reset password ${url}`)
  })

  it("renders the password reset notice without an action link", async () => {
    const message = await createPasswordResetNoticeEmailMessage({
      to: "owner@example.com",
    })

    expect(message).toMatchObject({
      subject: "Your webhooks.lol password was reset",
      to: "owner@example.com",
    })
    expect(message.html).toContain("<!DOCTYPE html")
    expect(message.html).toContain("Your password was reset")
    expect(normalizeRenderedText(message.html)).toContain(
      "if you did not request a password reset, update your password immediately"
    )
    expect(message.html).not.toContain("href=")
    expect(normalizeRenderedText(message.text)).toContain(
      "your password was reset"
    )
    expect(normalizeRenderedText(message.text)).toContain(
      "if you did not request a password reset, update your password immediately"
    )
  })
})

function normalizeRenderedText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ")
}
