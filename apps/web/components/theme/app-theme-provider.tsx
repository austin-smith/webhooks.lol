"use client"

import * as React from "react"

import {
  APP_THEME_STORAGE_KEY,
  APP_THEMES,
  DEFAULT_APP_THEME,
  type AppTheme,
  normalizeAppTheme,
  readAppThemeFromStorage,
  writeAppThemeToStorage,
} from "@/components/theme/app-theme"

type AppThemeContextValue = {
  appTheme: AppTheme
  setAppTheme: (theme: AppTheme) => void
}

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
  const [appTheme, setAppThemeState] = React.useState<AppTheme>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_APP_THEME
    }

    return readAppThemeFromStorage(window.localStorage)
  })

  React.useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== APP_THEME_STORAGE_KEY) {
        return
      }

      const nextTheme = normalizeAppTheme(event.newValue)

      setAppThemeState(nextTheme)
      applyAppTheme(nextTheme)
    }

    window.addEventListener("storage", onStorage)

    return () => {
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const setAppTheme = React.useCallback((theme: AppTheme) => {
    setAppThemeState(theme)
    applyAppTheme(theme)
    writeAppThemeToStorage(window.localStorage, theme)
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
