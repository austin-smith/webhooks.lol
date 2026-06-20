import { describe, expect, it } from "vitest"

import { resolveAuthRedirectPath } from "@/lib/auth/redirects"

describe("resolveAuthRedirectPath", () => {
  it("keeps same-origin paths", () => {
    expect(resolveAuthRedirectPath("/admin")).toBe("/admin")
    expect(resolveAuthRedirectPath("/endpoint/abc?tab=headers")).toBe(
      "/endpoint/abc?tab=headers"
    )
  })

  it("uses the first value when search params contain an array", () => {
    expect(resolveAuthRedirectPath(["/admin", "/account"])).toBe("/admin")
  })

  it("rejects external redirects", () => {
    expect(resolveAuthRedirectPath("https://example.com")).toBe("/")
    expect(resolveAuthRedirectPath("//example.com")).toBe("/")
  })

  it("rejects auth-internal redirects", () => {
    expect(resolveAuthRedirectPath("/api/auth/callback/github")).toBe("/")
  })

  it("falls back when missing", () => {
    expect(resolveAuthRedirectPath(undefined)).toBe("/")
  })
})
