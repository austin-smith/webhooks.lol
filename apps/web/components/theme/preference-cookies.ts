import { readCookieValue, serializeCookie } from "@/lib/cookies"

export const THEME_COOKIE_NAME = "webhooks-lol.theme"

export const APP_THEME_COOKIE_NAME = "webhooks-lol.app-theme"

export const SYNTAX_THEME_COOKIE_NAME = "webhooks-lol.syntax-theme"

const PREFERENCE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export function serializePreferenceCookie(
  name: string,
  value: string,
  { secure }: { secure: boolean }
) {
  return serializeCookie(name, value, {
    maxAgeSeconds: PREFERENCE_COOKIE_MAX_AGE_SECONDS,
    secure,
  })
}

export function readPreferenceCookie(name: string) {
  return readCookieValue(document.cookie, name)
}

export function writePreferenceCookie(name: string, value: string) {
  try {
    document.cookie = serializePreferenceCookie(name, value, {
      secure: window.location.protocol === "https:",
    })
  } catch {
    // The in-memory selection still applies to the current page.
  }
}
