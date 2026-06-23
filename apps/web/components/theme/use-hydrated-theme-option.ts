"use client"

import * as React from "react"

import {
  DEFAULT_THEME,
  normalizeThemeOption,
} from "@/components/theme/display-options"

export function useHydratedThemeOption(theme: string | undefined) {
  const isHydrated = React.useSyncExternalStore(
    subscribeHydration,
    getHydratedSnapshot,
    getServerHydrationSnapshot
  )

  return isHydrated ? normalizeThemeOption(theme) : DEFAULT_THEME
}

function subscribeHydration() {
  return () => {}
}

function getHydratedSnapshot() {
  return true
}

function getServerHydrationSnapshot() {
  return false
}
