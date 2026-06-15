"use client"

import * as React from "react"
import { useTheme } from "next-themes"

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
        event.key.toLowerCase() !== "d" ||
        isTextEntryTarget(event.target)
      ) {
        return
      }

      const currentTheme =
        resolvedTheme === "dark" || resolvedTheme === "light"
          ? resolvedTheme
          : document.documentElement.classList.contains("dark")
            ? "dark"
            : "light"

      const nextTheme = currentTheme === "dark" ? "light" : "dark"

      setTheme(nextTheme)
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [resolvedTheme, setTheme])

  return null
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
