"use client"

import * as React from "react"

import { THEME } from "@/components/theme/display-options"
import { useTheme } from "@/components/theme/theme-provider"

export function ThemeKeyboardShortcut() {
  const { resolvedTheme, setTheme } = useTheme()

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        !isThemeShortcutKey(event.key) ||
        isTextEntryTarget(event.target)
      ) {
        return
      }

      const currentTheme =
        resolvedTheme === THEME.DARK.value ||
        resolvedTheme === THEME.LIGHT.value
          ? resolvedTheme
          : document.documentElement.classList.contains("dark")
            ? THEME.DARK.value
            : THEME.LIGHT.value

      const nextTheme =
        currentTheme === THEME.DARK.value ? THEME.LIGHT.value : THEME.DARK.value

      setTheme(nextTheme)
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [resolvedTheme, setTheme])

  return null
}

export function isThemeShortcutKey(key: unknown) {
  return typeof key === "string" && key.toLowerCase() === "d"
}

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName.toLowerCase()

  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  )
}
