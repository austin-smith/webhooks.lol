import { describe, expect, it } from "vitest"

import {
  APPEARANCE,
  DEFAULT_APPEARANCE,
  DEFAULT_THEME,
  THEME,
  normalizeAppearanceOption,
  normalizeThemeOption,
} from "@/components/theme/display-options"

describe("display options", () => {
  it("normalizes unknown appearance values to the default", () => {
    expect(normalizeAppearanceOption(APPEARANCE.BRANDED.value)).toBe(
      APPEARANCE.BRANDED.value
    )
    expect(normalizeAppearanceOption(APPEARANCE.NEUTRAL.value)).toBe(
      APPEARANCE.NEUTRAL.value
    )
    expect(normalizeAppearanceOption(THEME.SYSTEM.value)).toBe(
      DEFAULT_APPEARANCE
    )
    expect(normalizeAppearanceOption(null)).toBe(DEFAULT_APPEARANCE)
  })

  it("normalizes unknown theme values to the default", () => {
    expect(normalizeThemeOption(THEME.SYSTEM.value)).toBe(THEME.SYSTEM.value)
    expect(normalizeThemeOption(THEME.LIGHT.value)).toBe(THEME.LIGHT.value)
    expect(normalizeThemeOption(THEME.DARK.value)).toBe(THEME.DARK.value)
    expect(normalizeThemeOption(APPEARANCE.NEUTRAL.value)).toBe(DEFAULT_THEME)
    expect(normalizeThemeOption(undefined)).toBe(DEFAULT_THEME)
  })
})
