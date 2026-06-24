import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  authRedirectSavesEndpoint,
  createAuthRedirectHref,
  createEmailVerificationCallbackPath,
} from "@/lib/auth/redirect-links"
import { resolveAuthRedirectPath } from "@/lib/auth/redirect-targets"

describe("resolveAuthRedirectPath", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://webhooks.lol")
  })

  it("keeps same-origin paths", () => {
    expect(resolveAuthRedirectPath("/admin")).toBe("/admin")
    expect(resolveAuthRedirectPath("/endpoint/abc?tab=headers")).toBe(
      "/endpoint/abc?tab=headers"
    )
  })

  it("normalizes same-origin absolute URLs to internal paths", () => {
    expect(resolveAuthRedirectPath("https://webhooks.lol/account")).toBe(
      "/account"
    )
    expect(
      resolveAuthRedirectPath(
        "https://webhooks.lol/endpoint/abc?tab=headers#body"
      )
    ).toBe("/endpoint/abc?tab=headers#body")
  })

  it("uses the first value when search params contain an array", () => {
    expect(resolveAuthRedirectPath(["/admin", "/account"])).toBe("/admin")
  })

  it("rejects external redirects", () => {
    expect(resolveAuthRedirectPath("https://example.com")).toBe("/")
    expect(resolveAuthRedirectPath("//example.com")).toBe("/")
    expect(resolveAuthRedirectPath("https://webhooks.lol.example.com")).toBe(
      "/"
    )
  })

  it("rejects browser-normalized network-path redirects", () => {
    expect(resolveAuthRedirectPath("/\\example.com")).toBe("/")
    expect(resolveAuthRedirectPath("/\\/example.com")).toBe("/")
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
