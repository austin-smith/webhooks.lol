import { describe, expect, it } from "vitest"

import {
  APP_THEME_COOKIE_NAME,
  SYNTAX_THEME_COOKIE_NAME,
  THEME_COOKIE_NAME,
  serializePreferenceCookie,
} from "@/components/theme/preference-cookies"

describe("preference cookies", () => {
  it("uses RFC 6265 compatible cookie names", () => {
    const validCookieName = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

    for (const name of [
      THEME_COOKIE_NAME,
      APP_THEME_COOKIE_NAME,
      SYNTAX_THEME_COOKIE_NAME,
    ]) {
      expect(name).toMatch(validCookieName)
    }
  })

  it("serializes a long-lived, site-wide, lax cookie", () => {
    expect(
      serializePreferenceCookie(THEME_COOKIE_NAME, "dark", { secure: false })
    ).toBe(`${THEME_COOKIE_NAME}=dark; Path=/; Max-Age=31536000; SameSite=Lax`)
  })

  it("adds the Secure attribute on secure origins", () => {
    expect(
      serializePreferenceCookie(THEME_COOKIE_NAME, "dark", { secure: true })
    ).toBe(
      `${THEME_COOKIE_NAME}=dark; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
    )
  })
})
