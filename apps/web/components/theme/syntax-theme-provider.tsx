"use client"

import * as React from "react"

import { SYNTAX_THEME_COOKIE_NAME } from "@/components/theme/preference-cookies"
import {
  isSyntaxThemeOption,
  type SyntaxThemeOption,
} from "@/components/theme/syntax-theme"
import { usePreferenceState } from "@/components/theme/use-preference-state"

type SyntaxThemeContextValue = {
  syntaxTheme: SyntaxThemeOption
  setSyntaxTheme: (theme: SyntaxThemeOption) => void
}

const SyntaxThemeContext = React.createContext<SyntaxThemeContextValue | null>(
  null
)

export function SyntaxThemeProvider({
  initialSyntaxTheme,
  children,
}: {
  initialSyntaxTheme: SyntaxThemeOption
  children: React.ReactNode
}) {
  const [syntaxTheme, setSyntaxTheme] = usePreferenceState({
    cookieName: SYNTAX_THEME_COOKIE_NAME,
    initialValue: initialSyntaxTheme,
    isValid: isSyntaxThemeOption,
  })

  const contextValue = React.useMemo(
    () => ({ syntaxTheme, setSyntaxTheme }),
    [syntaxTheme, setSyntaxTheme]
  )

  return (
    <SyntaxThemeContext.Provider value={contextValue}>
      {children}
    </SyntaxThemeContext.Provider>
  )
}

export function useSyntaxTheme() {
  const context = React.useContext(SyntaxThemeContext)

  if (!context) {
    throw new Error("useSyntaxTheme must be used within SyntaxThemeProvider")
  }

  return context
}
