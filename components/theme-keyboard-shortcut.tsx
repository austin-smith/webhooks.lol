"use client"

import * as React from "react"

import { THEME_STORAGE_KEY } from "@/lib/theme"

type ThemePreference = "dark" | "light"

export function ThemeKeyboardShortcut() {
  React.useEffect(() => {
    applyStoredTheme()

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

      const nextTheme = document.documentElement.classList.contains("dark")
        ? "light"
        : "dark"

      applyTheme(nextTheme)
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
      } catch {
        // Theme still changes for the current page even if persistence is blocked.
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  return null
}

function applyStoredTheme() {
  let storedTheme: string | null = null

  try {
    storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  } catch {
    storedTheme = null
  }

  if (storedTheme === "dark" || storedTheme === "light") {
    applyTheme(storedTheme)
    return
  }

  applyTheme(getSystemTheme())
}

function applyTheme(theme: ThemePreference) {
  document.documentElement.classList.toggle("dark", theme === "dark")
}

function getSystemTheme(): ThemePreference {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
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
