import { describe, expect, it } from "vitest"

import { resolveAccountSecurity } from "@/lib/auth/account-security"

describe("account security", () => {
  it("allows password changes for credential accounts", () => {
    expect(
      resolveAccountSecurity([{ providerId: "credential" }])
    ).toStrictEqual({
      canChangePassword: true,
      signInMethodLabel: "Email and password",
    })
  })

  it("does not allow password changes for GitHub accounts", () => {
    expect(resolveAccountSecurity([{ providerId: "github" }])).toStrictEqual({
      canChangePassword: false,
      signInMethodLabel: "GitHub",
    })
  })

  it("does not allow password changes for unknown external providers", () => {
    expect(resolveAccountSecurity([{ providerId: "sso" }])).toStrictEqual({
      canChangePassword: false,
      signInMethodLabel: "External provider",
    })
  })
})
