import type { BundledTheme } from "shiki"

export const SYNTAX_THEME_PREVIEW_CODE = `{
  "event": "request.created",
  "status": 200
}`

type SyntaxThemeDefinition = {
  value: string
  label: string
  themes: {
    dark: BundledTheme
    light: BundledTheme
  }
}

export const SYNTAX_THEME = {
  CATPPUCCIN: {
    value: "catppuccin",
    label: "Catppuccin",
    themes: {
      dark: "catppuccin-mocha",
      light: "catppuccin-latte",
    },
  },
  GITHUB: {
    value: "github",
    label: "GitHub",
    themes: {
      dark: "github-dark",
      light: "github-light",
    },
  },
  GRUVBOX: {
    value: "gruvbox",
    label: "Gruvbox",
    themes: {
      dark: "gruvbox-dark-medium",
      light: "gruvbox-light-medium",
    },
  },
  MIN: {
    value: "min",
    label: "Min",
    themes: {
      dark: "min-dark",
      light: "min-light",
    },
  },
  SOLARIZED: {
    value: "solarized",
    label: "Solarized",
    themes: {
      dark: "solarized-dark",
      light: "solarized-light",
    },
  },
  VITESSE: {
    value: "vitesse",
    label: "Vitesse",
    themes: {
      dark: "vitesse-dark",
      light: "vitesse-light",
    },
  },
} as const satisfies Record<string, SyntaxThemeDefinition>

export type SyntaxThemeOption =
  (typeof SYNTAX_THEME)[keyof typeof SYNTAX_THEME]["value"]

export type SyntaxThemePair = {
  dark: BundledTheme
  light: BundledTheme
}

export const SYNTAX_THEME_OPTIONS = Object.values(SYNTAX_THEME)

export const SYNTAX_THEME_VALUES = SYNTAX_THEME_OPTIONS.map(
  (theme) => theme.value
)

export const DEFAULT_SYNTAX_THEME: SyntaxThemeOption =
  SYNTAX_THEME.VITESSE.value

export function getSyntaxThemeLabel(theme: SyntaxThemeOption) {
  return SYNTAX_THEME_OPTIONS.find((option) => option.value === theme)!.label
}

export function getSyntaxThemePair(theme: SyntaxThemeOption): SyntaxThemePair {
  return SYNTAX_THEME_OPTIONS.find((option) => option.value === theme)!.themes
}

export function isSyntaxThemeOption(
  value: unknown
): value is SyntaxThemeOption {
  return (
    typeof value === "string" &&
    SYNTAX_THEME_VALUES.includes(value as SyntaxThemeOption)
  )
}

export function normalizeSyntaxThemeOption(value: unknown): SyntaxThemeOption {
  return isSyntaxThemeOption(value) ? value : DEFAULT_SYNTAX_THEME
}
