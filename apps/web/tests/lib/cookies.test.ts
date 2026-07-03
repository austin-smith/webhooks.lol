import { describe, expect, it } from "vitest"

import { readCookieValue, serializeCookie } from "@/lib/cookies"

describe("readCookieValue", () => {
  it("reads a named cookie from a header", () => {
    expect(readCookieValue("a=1; b=hello%20there; c=3", "b")).toBe(
      "hello there"
    )
  })

  it("returns the raw value when decoding fails", () => {
    expect(readCookieValue("a=%E0%A4%A", "a")).toBe("%E0%A4%A")
  })

  it("keeps embedded equals signs in values", () => {
    expect(readCookieValue("token=abc=def", "token")).toBe("abc=def")
  })

  it("returns null for missing cookies or headers", () => {
    expect(readCookieValue("a=1", "b")).toBeNull()
    expect(readCookieValue(null, "a")).toBeNull()
  })
})

describe("serializeCookie", () => {
  it("serializes a site-wide lax cookie", () => {
    expect(
      serializeCookie("name", "value", { maxAgeSeconds: 60, secure: false })
    ).toBe("name=value; Path=/; Max-Age=60; SameSite=Lax")
  })

  it("adds HttpOnly and Secure attributes when requested", () => {
    expect(
      serializeCookie("name", "value", {
        httpOnly: true,
        maxAgeSeconds: 60,
        secure: true,
      })
    ).toBe("name=value; Path=/; Max-Age=60; SameSite=Lax; HttpOnly; Secure")
  })

  it("encodes cookie values", () => {
    expect(
      serializeCookie("name", "a b", { maxAgeSeconds: 60, secure: false })
    ).toBe("name=a%20b; Path=/; Max-Age=60; SameSite=Lax")
  })
})
