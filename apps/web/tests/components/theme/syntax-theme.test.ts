import { describe, expect, it } from "vitest"

import {
  DEFAULT_SYNTAX_THEME,
  SYNTAX_THEME,
  SYNTAX_THEME_OPTIONS,
  SYNTAX_THEME_STORAGE_KEY,
  getSyntaxThemePair,
  getSyntaxThemeStorage,
  normalizeSyntaxThemeOption,
  readSyntaxThemeFromStorage,
  writeSyntaxThemeToStorage,
} from "@/components/theme/syntax-theme"

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

class ThrowingStorage {
  getItem(): string | null {
    throw new Error("storage unavailable")
  }

  setItem(): void {
    throw new Error("storage unavailable")
  }
}

class ThrowingStorageSource {
  get localStorage(): never {
    throw new Error("storage blocked")
  }
}

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

describe("syntax theme storage", () => {
  it("reads a valid stored syntax theme", () => {
    const storage = new MemoryStorage()

    storage.setItem(SYNTAX_THEME_STORAGE_KEY, SYNTAX_THEME.SOLARIZED.value)

    expect(readSyntaxThemeFromStorage(storage)).toBe(
      SYNTAX_THEME.SOLARIZED.value
    )
  })

  it("falls back when stored syntax theme storage is invalid or unavailable", () => {
    const storage = new MemoryStorage()

    storage.setItem(SYNTAX_THEME_STORAGE_KEY, "night-owl")

    expect(readSyntaxThemeFromStorage(storage)).toBe(DEFAULT_SYNTAX_THEME)
    expect(readSyntaxThemeFromStorage(new ThrowingStorage())).toBe(
      DEFAULT_SYNTAX_THEME
    )
  })

  it("returns null when local storage access is blocked", () => {
    expect(getSyntaxThemeStorage(new ThrowingStorageSource())).toBeNull()
    expect(getSyntaxThemeStorage(null)).toBeNull()
  })

  it("returns available local storage", () => {
    const storage = new MemoryStorage()

    expect(getSyntaxThemeStorage({ localStorage: storage })).toBe(storage)
  })

  it("writes syntax themes without surfacing storage failures", () => {
    const storage = new MemoryStorage()

    writeSyntaxThemeToStorage(storage, SYNTAX_THEME.GRUVBOX.value)
    writeSyntaxThemeToStorage(new ThrowingStorage(), SYNTAX_THEME.MIN.value)

    expect(storage.getItem(SYNTAX_THEME_STORAGE_KEY)).toBe(
      SYNTAX_THEME.GRUVBOX.value
    )
  })
})
