import { describe, expect, it } from "vitest"

import {
  authRedirectSavesEndpoint,
  createAuthRedirectHref,
  createEmailVerificationCallbackPath,
  resolveAuthRedirectPath,
} from "@/lib/auth/redirects"

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

describe("auth redirect helpers", () => {
  it("preserves endpoint save redirects through auth links", () => {
    const callbackPath = "/?saveEndpoint=11111111-1111-4111-8111-111111111111"

    expect(authRedirectSavesEndpoint(callbackPath)).toBe(true)
    expect(createAuthRedirectHref("/login", callbackPath)).toBe(
      "/login?next=%2F%3FsaveEndpoint%3D11111111-1111-4111-8111-111111111111"
    )
    expect(createEmailVerificationCallbackPath(callbackPath)).toBe(
      "/email-verified?next=%2F%3FsaveEndpoint%3D11111111-1111-4111-8111-111111111111"
    )
  })

  it("keeps default auth links clean when no callback path is needed", () => {
    expect(authRedirectSavesEndpoint("/")).toBe(false)
    expect(createAuthRedirectHref("/login", "/")).toBe("/login")
    expect(createEmailVerificationCallbackPath("/")).toBe("/email-verified")
  })
})
