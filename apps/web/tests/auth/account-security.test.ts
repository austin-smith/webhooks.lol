import { describe, expect, it } from "vitest"

import { resolveAccountSecurity } from "@/lib/auth/account-security"

describe("account security", () => {
  it("allows password resets for credential accounts", () => {
    expect(
      resolveAccountSecurity([{ providerId: "credential" }])
    ).toStrictEqual({
      canResetPassword: true,
      signInMethodLabel: "Email and password",
    })
  })

  it("does not allow password resets for GitHub accounts", () => {
    expect(resolveAccountSecurity([{ providerId: "github" }])).toStrictEqual({
      canResetPassword: false,
      signInMethodLabel: "GitHub",
    })
  })

  it("does not allow password resets for unknown external providers", () => {
    expect(resolveAccountSecurity([{ providerId: "sso" }])).toStrictEqual({
      canResetPassword: false,
      signInMethodLabel: "External provider",
    })
  })
})
