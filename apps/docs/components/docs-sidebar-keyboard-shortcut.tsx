"use client"

import * as React from "react"
import { useSidebar } from "fumadocs-ui/layouts/docs/slots/sidebar"

export function DocsSidebarKeyboardShortcut() {
  const { mode, setCollapsed, setOpen } = useSidebar()

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const hasPrimaryModifier = event.metaKey || event.ctrlKey
      const hasBothPrimaryModifiers = event.metaKey && event.ctrlKey

      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.shiftKey ||
        !hasPrimaryModifier ||
        hasBothPrimaryModifiers ||
        event.key.toLowerCase() !== "b"
      ) {
        return
      }

      event.preventDefault()

      const toggle = mode === "drawer" ? setOpen : setCollapsed
      toggle((open) => !open)
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [mode, setCollapsed, setOpen])

  return null
}
