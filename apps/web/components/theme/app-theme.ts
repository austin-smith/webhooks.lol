import {
  APPEARANCE_VALUES,
  DEFAULT_APPEARANCE,
  type AppearanceOption,
  getAppearanceLabel,
  isAppearanceOption,
  normalizeAppearanceOption,
} from "@/components/theme/display-options"

export const APP_THEME_STORAGE_KEY = "webhooks.lol:app-theme"

export const APP_THEMES = APPEARANCE_VALUES

export type AppTheme = AppearanceOption

export const DEFAULT_APP_THEME: AppTheme = DEFAULT_APPEARANCE

export const APP_THEME_LABELS: Record<AppTheme, string> = Object.fromEntries(
  APP_THEMES.map((theme) => [theme, getAppearanceLabel(theme)])
) as Record<AppTheme, string>

export type AppThemeStorage = Pick<Storage, "getItem" | "setItem">

type AppThemeStorageSource = {
  readonly localStorage: AppThemeStorage
}

export function isAppTheme(value: unknown): value is AppTheme {
  return isAppearanceOption(value)
}

export function normalizeAppTheme(value: unknown): AppTheme {
  return normalizeAppearanceOption(value)
}

export function getAppThemeStorage(
  source?: AppThemeStorageSource | null
): AppThemeStorage | null {
  const storageSource =
    source === undefined
      ? typeof window === "undefined"
        ? null
        : window
      : source

  if (!storageSource) {
    return null
  }

  try {
    return storageSource.localStorage
  } catch {
    return null
  }
}

export function readAppThemeFromStorage(
  storage: Pick<Storage, "getItem"> | null
): AppTheme {
  if (!storage) {
    return DEFAULT_APP_THEME
  }

  try {
    return normalizeAppTheme(storage.getItem(APP_THEME_STORAGE_KEY))
  } catch {
    return DEFAULT_APP_THEME
  }
}

export function writeAppThemeToStorage(
  storage: Pick<Storage, "setItem"> | null,
  theme: AppTheme
) {
  if (!storage) {
    return
  }

  try {
    storage.setItem(APP_THEME_STORAGE_KEY, theme)
  } catch {
    // The applied DOM theme still works for the current page.
  }
}
