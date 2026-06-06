import { describe, expect, it } from "vitest"

import { hasBetterAuthAdminRole } from "@/lib/auth/authorization"

describe("hasBetterAuthAdminRole", () => {
  it.each([
    ["admin", true],
    ["user,admin", true],
    ["admin,user", true],
    ["user, admin", true],
    ["user", false],
    [null, false],
    [undefined, false],
  ] satisfies Array<[string | null | undefined, boolean]>)(
    "returns %s access as %s",
    (role, expected) => {
      expect(hasBetterAuthAdminRole(role)).toBe(expected)
    }
  )
})
