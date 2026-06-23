"use client"

import * as React from "react"

import {
  DEFAULT_SYNTAX_THEME,
  SYNTAX_THEME_STORAGE_KEY,
  type SyntaxThemeOption,
  getSyntaxThemeStorage,
  readSyntaxThemeFromStorage,
  writeSyntaxThemeToStorage,
} from "@/components/theme/syntax-theme"

const SYNTAX_THEME_CHANGE_EVENT = "webhooks.lol:syntax-theme-change"

let samePageSyntaxTheme: SyntaxThemeOption | null = null

export function useSyntaxTheme() {
  const syntaxTheme = React.useSyncExternalStore(
    subscribeSyntaxTheme,
    getSyntaxThemeSnapshot,
    getSyntaxThemeServerSnapshot
  )

  const setSyntaxTheme = React.useCallback((theme: SyntaxThemeOption) => {
    samePageSyntaxTheme = theme
    writeSyntaxThemeToStorage(getSyntaxThemeStorage(), theme)
    publishSyntaxThemeChange()
  }, [])

  return React.useMemo(
    () => ({ syntaxTheme, setSyntaxTheme }),
    [syntaxTheme, setSyntaxTheme]
  )
}

function getSyntaxThemeSnapshot() {
  return (
    samePageSyntaxTheme ?? readSyntaxThemeFromStorage(getSyntaxThemeStorage())
  )
}

function getSyntaxThemeServerSnapshot() {
  return DEFAULT_SYNTAX_THEME
}

function subscribeSyntaxTheme(onStoreChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === SYNTAX_THEME_STORAGE_KEY) {
      samePageSyntaxTheme = null
      onStoreChange()
    }
  }

  window.addEventListener("storage", onStorage)
  window.addEventListener(SYNTAX_THEME_CHANGE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(SYNTAX_THEME_CHANGE_EVENT, onStoreChange)
  }
}

function publishSyntaxThemeChange() {
  window.dispatchEvent(new Event(SYNTAX_THEME_CHANGE_EVENT))
}
