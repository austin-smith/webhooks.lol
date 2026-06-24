import { describe, expect, it } from "vitest"

import { isThemeShortcutKey } from "@/components/theme/theme-keyboard-shortcut"

describe("isThemeShortcutKey", () => {
  it("matches the theme shortcut key case-insensitively", () => {
    expect(isThemeShortcutKey("d")).toBe(true)
    expect(isThemeShortcutKey("D")).toBe(true)
  })

  it("ignores other keys", () => {
    expect(isThemeShortcutKey("x")).toBe(false)
    expect(isThemeShortcutKey("")).toBe(false)
  })

  it("ignores missing or malformed keys", () => {
    expect(isThemeShortcutKey(undefined)).toBe(false)
    expect(isThemeShortcutKey(null)).toBe(false)
    expect(isThemeShortcutKey(0)).toBe(false)
  })
})
