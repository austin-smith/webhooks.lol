import { describe, expect, it } from "vitest"

import {
  DEFAULT_SYNTAX_THEME,
  SYNTAX_THEME,
  SYNTAX_THEME_OPTIONS,
  getSyntaxThemePair,
  normalizeSyntaxThemeOption,
} from "@/components/theme/syntax-theme"

describe("syntax theme options", () => {
  it("keeps syntax theme options in alphabetical label order", () => {
    expect(SYNTAX_THEME_OPTIONS.map((option) => option.label)).toEqual([
      "Catppuccin",
      "GitHub",
      "Gruvbox",
      "Min",
      "Solarized",
      "Vitesse",
    ])
  })

  it("normalizes unknown syntax theme values to the default", () => {
    expect(normalizeSyntaxThemeOption(SYNTAX_THEME.VITESSE.value)).toBe(
      SYNTAX_THEME.VITESSE.value
    )
    expect(normalizeSyntaxThemeOption(SYNTAX_THEME.GITHUB.value)).toBe(
      SYNTAX_THEME.GITHUB.value
    )
    expect(normalizeSyntaxThemeOption("dracula")).toBe(DEFAULT_SYNTAX_THEME)
    expect(normalizeSyntaxThemeOption(null)).toBe(DEFAULT_SYNTAX_THEME)
  })

  it("returns the configured light and dark Shiki theme pair", () => {
    expect(getSyntaxThemePair(SYNTAX_THEME.GITHUB.value)).toEqual({
      dark: "github-dark",
      light: "github-light",
    })
  })
})
