"use client"

import * as React from "react"

import {
  isAppearanceOption,
  type AppearanceOption,
} from "@/components/theme/display-options"
import { APP_THEME_COOKIE_NAME } from "@/components/theme/preference-cookies"
import { usePreferenceState } from "@/components/theme/use-preference-state"

type AppThemeContextValue = {
  appTheme: AppearanceOption
  setAppTheme: (theme: AppearanceOption) => void
}

const AppThemeContext = React.createContext<AppThemeContextValue | null>(null)

export function AppThemeProvider({
  initialAppTheme,
  children,
}: {
  initialAppTheme: AppearanceOption
  children: React.ReactNode
}) {
  const [appTheme, setAppTheme] = usePreferenceState({
    cookieName: APP_THEME_COOKIE_NAME,
    initialValue: initialAppTheme,
    isValid: isAppearanceOption,
    onValueChange: applyAppThemeToDocument,
  })

  const contextValue = React.useMemo(
    () => ({ appTheme, setAppTheme }),
    [appTheme, setAppTheme]
  )

  return (
    <AppThemeContext.Provider value={contextValue}>
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

function applyAppThemeToDocument(theme: AppearanceOption) {
  document.documentElement.dataset.appTheme = theme
}
