import { cookies } from "next/headers"

import {
  DARK_CLASS_NAME,
  SYSTEM_DARK_MEDIA_QUERY,
  THEME,
  normalizeAppearanceOption,
  normalizeThemeOption,
  type AppearanceOption,
  type ThemeOption,
} from "@/components/theme/display-options"
import {
  APP_THEME_COOKIE_NAME,
  SYNTAX_THEME_COOKIE_NAME,
  THEME_COOKIE_NAME,
} from "@/components/theme/preference-cookies"
import {
  normalizeSyntaxThemeOption,
  type SyntaxThemeOption,
} from "@/components/theme/syntax-theme"

export type DisplayPreferences = {
  appTheme: AppearanceOption
  syntaxTheme: SyntaxThemeOption
  theme: ThemeOption
}

export async function readDisplayPreferences(): Promise<DisplayPreferences> {
  const cookieStore = await cookies()

  return {
    appTheme: normalizeAppearanceOption(
      cookieStore.get(APP_THEME_COOKIE_NAME)?.value
    ),
    syntaxTheme: normalizeSyntaxThemeOption(
      cookieStore.get(SYNTAX_THEME_COOKIE_NAME)?.value
    ),
    theme: normalizeThemeOption(cookieStore.get(THEME_COOKIE_NAME)?.value),
  }
}

// Never render the dark class via <html className>. React overwrites the whole
// class attribute whenever its rendered value changes, so a router.refresh()
// after the user switches themes in-page would wipe the class that
// theme-provider.tsx sets with classList (e.g. theme=system on a dark-OS
// machine goes light). Keeping <html className> constant means React never
// touches it; this inline script sets the class instead, and because the
// browser runs it before painting anything after it, there is no flash.
export function ThemeBootstrapScript({ theme }: { theme: ThemeOption }) {
  const script = `((theme) => {
  if (
    theme === ${JSON.stringify(THEME.DARK.value)} ||
    (theme === ${JSON.stringify(THEME.SYSTEM.value)} &&
      window.matchMedia(${JSON.stringify(SYSTEM_DARK_MEDIA_QUERY)}).matches)
  ) {
    document.documentElement.classList.add(${JSON.stringify(DARK_CLASS_NAME)})
  }
})(${JSON.stringify(theme)})`

  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
