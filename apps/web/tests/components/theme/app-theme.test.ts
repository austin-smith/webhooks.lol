import { describe, expect, it } from "vitest"

import {
  APP_THEME_STORAGE_KEY,
  DEFAULT_APP_THEME,
  getAppThemeStorage,
  normalizeAppTheme,
  readAppThemeFromStorage,
  writeAppThemeToStorage,
} from "@/components/theme/app-theme"

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

describe("app theme storage", () => {
  it("normalizes unknown app themes to the default", () => {
    expect(normalizeAppTheme("neutral")).toBe("neutral")
    expect(normalizeAppTheme("branded")).toBe("branded")
    expect(normalizeAppTheme("simple")).toBe(DEFAULT_APP_THEME)
    expect(normalizeAppTheme("dark")).toBe(DEFAULT_APP_THEME)
    expect(normalizeAppTheme(null)).toBe(DEFAULT_APP_THEME)
  })

  it("reads a valid stored app theme", () => {
    const storage = new MemoryStorage()

    storage.setItem(APP_THEME_STORAGE_KEY, "neutral")

    expect(readAppThemeFromStorage(storage)).toBe("neutral")
  })

  it("falls back when stored app theme storage is invalid or unavailable", () => {
    const storage = new MemoryStorage()

    storage.setItem(APP_THEME_STORAGE_KEY, "high-contrast")

    expect(readAppThemeFromStorage(storage)).toBe(DEFAULT_APP_THEME)
    expect(readAppThemeFromStorage(new ThrowingStorage())).toBe(
      DEFAULT_APP_THEME
    )
  })

  it("returns null when local storage access is blocked", () => {
    expect(getAppThemeStorage(new ThrowingStorageSource())).toBeNull()
    expect(getAppThemeStorage(null)).toBeNull()
  })

  it("returns available local storage", () => {
    const storage = new MemoryStorage()

    expect(getAppThemeStorage({ localStorage: storage })).toBe(storage)
  })

  it("writes app themes without surfacing storage failures", () => {
    const storage = new MemoryStorage()

    writeAppThemeToStorage(storage, "neutral")
    writeAppThemeToStorage(new ThrowingStorage(), "branded")

    expect(storage.getItem(APP_THEME_STORAGE_KEY)).toBe("neutral")
  })
})
