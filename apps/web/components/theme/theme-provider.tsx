"use client"

import * as React from "react"

import {
  DARK_CLASS_NAME,
  SYSTEM_DARK_MEDIA_QUERY,
  THEME,
  isThemeOption,
  type ThemeOption,
} from "@/components/theme/display-options"
import { THEME_COOKIE_NAME } from "@/components/theme/preference-cookies"
import { usePreferenceState } from "@/components/theme/use-preference-state"

type ResolvedTheme = typeof THEME.LIGHT.value | typeof THEME.DARK.value

type ThemeContextValue = {
  theme: ThemeOption
  resolvedTheme: ResolvedTheme | null
  setTheme: (theme: ThemeOption) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: ThemeOption
  children: React.ReactNode
}) {
  const [theme, setTheme] = usePreferenceState({
    cookieName: THEME_COOKIE_NAME,
    initialValue: initialTheme,
    isValid: isThemeOption,
    onValueChange: applyThemeToDocument,
  })
  const systemPrefersDark = React.useSyncExternalStore(
    subscribeToSystemPreference,
    getSystemPrefersDark,
    getServerSystemPrefersDark
  )

  const resolvedTheme =
    theme !== THEME.SYSTEM.value
      ? theme
      : systemPrefersDark === null
        ? null
        : toResolvedTheme(systemPrefersDark)

  React.useEffect(() => {
    if (theme === THEME.SYSTEM.value && systemPrefersDark !== null) {
      applyResolvedThemeToDocument(toResolvedTheme(systemPrefersDark))
    }
  }, [systemPrefersDark, theme])

  const contextValue = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  )

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = React.useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }

  return context
}

let systemDarkMediaQueryList: MediaQueryList | null = null

function getSystemDarkMediaQueryList() {
  systemDarkMediaQueryList ??= window.matchMedia(SYSTEM_DARK_MEDIA_QUERY)

  return systemDarkMediaQueryList
}

function subscribeToSystemPreference(onStoreChange: () => void) {
  const mediaQuery = getSystemDarkMediaQueryList()

  mediaQuery.addEventListener("change", onStoreChange)

  return () => {
    mediaQuery.removeEventListener("change", onStoreChange)
  }
}

function getSystemPrefersDark(): boolean | null {
  return getSystemDarkMediaQueryList().matches
}

function getServerSystemPrefersDark(): boolean | null {
  return null
}

function toResolvedTheme(prefersDark: boolean): ResolvedTheme {
  return prefersDark ? THEME.DARK.value : THEME.LIGHT.value
}

function applyThemeToDocument(theme: ThemeOption) {
  applyResolvedThemeToDocument(
    theme === THEME.SYSTEM.value
      ? toResolvedTheme(getSystemDarkMediaQueryList().matches)
      : theme
  )
}

function applyResolvedThemeToDocument(resolved: ResolvedTheme) {
  const shouldBeDark = resolved === THEME.DARK.value
  const classList = document.documentElement.classList

  if (classList.contains(DARK_CLASS_NAME) === shouldBeDark) {
    return
  }

  withTransitionsDisabled(() => {
    classList.toggle(DARK_CLASS_NAME, shouldBeDark)
  })
}

function withTransitionsDisabled(apply: () => void) {
  const style = document.createElement("style")

  style.appendChild(
    document.createTextNode("*,*::before,*::after{transition:none!important}")
  )
  document.head.appendChild(style)

  apply()

  // Reading a property forces a style flush so the override takes effect
  // before it is removed.
  void window.getComputedStyle(document.body).transition
  window.setTimeout(() => {
    document.head.removeChild(style)
  }, 1)
}
