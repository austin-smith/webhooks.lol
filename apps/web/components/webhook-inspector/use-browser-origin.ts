"use client"

import * as React from "react"

export function useBrowserOrigin() {
  return React.useSyncExternalStore(
    React.useCallback(() => () => undefined, []),
    () => window.location.origin,
    () => ""
  )
}
