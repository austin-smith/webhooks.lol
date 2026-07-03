import { MonitorIcon, MoonIcon, SunIcon, type LucideIcon } from "lucide-react"

export const APPEARANCE = {
  BRANDED: { value: "branded", label: "Branded" },
  NEUTRAL: { value: "neutral", label: "Neutral" },
} as const

export type AppearanceOption =
  (typeof APPEARANCE)[keyof typeof APPEARANCE]["value"]

export const APPEARANCE_OPTIONS = Object.values(APPEARANCE)

export const APPEARANCE_VALUES = APPEARANCE_OPTIONS.map(
  (appearance) => appearance.value
)

export const DEFAULT_APPEARANCE: AppearanceOption = APPEARANCE.BRANDED.value

export const THEME = {
  SYSTEM: { value: "system", label: "System", icon: MonitorIcon },
  LIGHT: { value: "light", label: "Light", icon: SunIcon },
  DARK: { value: "dark", label: "Dark", icon: MoonIcon },
} as const

// The class name must match the selectors in app/globals.css
// (@custom-variant dark and the .dark token blocks).
export const DARK_CLASS_NAME = "dark"

export const SYSTEM_DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)"

export type ThemeOption = (typeof THEME)[keyof typeof THEME]["value"]

export type ThemeIcon = LucideIcon

export const THEME_OPTIONS = Object.values(THEME)

export const THEME_VALUES = THEME_OPTIONS.map((theme) => theme.value)

export const DEFAULT_THEME: ThemeOption = THEME.SYSTEM.value

export function getThemeLabel(theme: ThemeOption) {
  return THEME_OPTIONS.find((option) => option.value === theme)!.label
}

export function isAppearanceOption(value: unknown): value is AppearanceOption {
  return (
    typeof value === "string" &&
    APPEARANCE_VALUES.includes(value as AppearanceOption)
  )
}

export function normalizeAppearanceOption(value: unknown): AppearanceOption {
  return isAppearanceOption(value) ? value : DEFAULT_APPEARANCE
}

export function isThemeOption(value: unknown): value is ThemeOption {
  return (
    typeof value === "string" && THEME_VALUES.includes(value as ThemeOption)
  )
}

export function normalizeThemeOption(value: unknown): ThemeOption {
  return isThemeOption(value) ? value : DEFAULT_THEME
}
