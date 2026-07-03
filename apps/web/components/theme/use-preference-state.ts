"use client"

import * as React from "react"

import {
  readPreferenceCookie,
  writePreferenceCookie,
} from "@/components/theme/preference-cookies"

export function usePreferenceState<T extends string>({
  cookieName,
  initialValue,
  isValid,
  onValueChange,
}: {
  cookieName: string
  initialValue: T
  isValid: (value: unknown) => value is T
  onValueChange?: (value: T) => void
}) {
  const [value, setValueState] = React.useState(initialValue)

  // Rewrite the stored cookie on mount so the rolling Max-Age is extended by
  // ordinary visits, not only by explicit preference changes (Safari caps
  // document.cookie writes at 7 days, so this matters beyond the 1-year cap).
  React.useEffect(() => {
    const storedValue = readPreferenceCookie(cookieName)

    if (isValid(storedValue)) {
      writePreferenceCookie(cookieName, storedValue)
    }
  }, [cookieName, isValid])

  React.useEffect(() => {
    return subscribeToPreferenceChanges(cookieName, (nextValue) => {
      if (!isValid(nextValue)) {
        return
      }

      onValueChange?.(nextValue)
      setValueState(nextValue)
    })
  }, [cookieName, isValid, onValueChange])

  const setValue = React.useCallback(
    (nextValue: T) => {
      onValueChange?.(nextValue)
      writePreferenceCookie(cookieName, nextValue)
      setValueState(nextValue)
      // Broadcast last so a failure here cannot strand local state.
      publishPreferenceChange(cookieName, nextValue)
    },
    [cookieName, onValueChange]
  )

  return [value, setValue] as const
}

function publishPreferenceChange(channelName: string, value: string) {
  const channel = new BroadcastChannel(channelName)

  channel.postMessage(value)
  channel.close()
}

function subscribeToPreferenceChanges(
  channelName: string,
  onChange: (value: unknown) => void
) {
  const channel = new BroadcastChannel(channelName)

  channel.onmessage = (event) => {
    onChange(event.data)
  }

  return () => {
    channel.close()
  }
}
