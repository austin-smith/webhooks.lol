export const APP_THEME_STORAGE_KEY = "webhooks.lol:app-theme"

export const APP_THEMES = ["branded", "neutral"] as const

export type AppTheme = (typeof APP_THEMES)[number]

export const DEFAULT_APP_THEME: AppTheme = "branded"

export const APP_THEME_LABELS: Record<AppTheme, string> = {
  branded: "Branded",
  neutral: "Neutral",
}

export type AppThemeStorage = Pick<Storage, "getItem" | "setItem">

type AppThemeStorageSource = {
  readonly localStorage: AppThemeStorage
}

export function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === "string" && APP_THEMES.includes(value as AppTheme)
}

export function normalizeAppTheme(value: unknown): AppTheme {
  return isAppTheme(value) ? value : DEFAULT_APP_THEME
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
