"use client"

import * as React from "react"

import {
  APP_THEME_STORAGE_KEY,
  APP_THEMES,
  DEFAULT_APP_THEME,
  type AppTheme,
  getAppThemeStorage,
  readAppThemeFromStorage,
  writeAppThemeToStorage,
} from "@/components/theme/app-theme"

type AppThemeContextValue = {
  appTheme: AppTheme
  setAppTheme: (theme: AppTheme) => void
}

const APP_THEME_CHANGE_EVENT = "webhooks.lol:app-theme-change"

const AppThemeContext = React.createContext<AppThemeContextValue | null>(null)

const appThemeBootstrapScript = `
(() => {
  const storageKey = ${JSON.stringify(APP_THEME_STORAGE_KEY)}
  const defaultTheme = ${JSON.stringify(DEFAULT_APP_THEME)}
  const themes = new Set(${JSON.stringify(APP_THEMES)})

  try {
    const storedTheme = window.localStorage.getItem(storageKey)
    const appTheme = themes.has(storedTheme) ? storedTheme : defaultTheme

    document.documentElement.dataset.appTheme = appTheme
  } catch {
    document.documentElement.dataset.appTheme = defaultTheme
  }
})()
`

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const appTheme = React.useSyncExternalStore(
    subscribeAppTheme,
    getAppThemeSnapshot,
    getAppThemeServerSnapshot
  )

  React.useEffect(() => {
    applyAppTheme(getAppThemeSnapshot())
  }, [appTheme])

  const setAppTheme = React.useCallback((theme: AppTheme) => {
    applyAppTheme(theme)
    writeAppThemeToStorage(getAppThemeStorage(), theme)
    publishAppThemeChange()
  }, [])

  const contextValue = React.useMemo(
    () => ({ appTheme, setAppTheme }),
    [appTheme, setAppTheme]
  )

  return (
    <AppThemeContext.Provider value={contextValue}>
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: appThemeBootstrapScript }}
      />
      {children}
    </AppThemeContext.Provider>
  )
}

export function useAppTheme() {
  const context = React.useContext(AppThemeContext)

  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider")
  }

  return context
}

function applyAppTheme(theme: AppTheme) {
  document.documentElement.dataset.appTheme = theme
}

function getAppThemeSnapshot() {
  return readAppThemeFromStorage(getAppThemeStorage())
}

function getAppThemeServerSnapshot() {
  return DEFAULT_APP_THEME
}

function subscribeAppTheme(onStoreChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === APP_THEME_STORAGE_KEY) {
      onStoreChange()
    }
  }

  window.addEventListener("storage", onStorage)
  window.addEventListener(APP_THEME_CHANGE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(APP_THEME_CHANGE_EVENT, onStoreChange)
  }
}

function publishAppThemeChange() {
  window.dispatchEvent(new Event(APP_THEME_CHANGE_EVENT))
}
