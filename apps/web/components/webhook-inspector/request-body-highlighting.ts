import type { BundledLanguage } from "shiki"
import { createHighlighterCore } from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"
import { bundledLanguages } from "shiki/langs"
import { bundledThemes } from "shiki/themes"

import {
  DEFAULT_SYNTAX_THEME,
  type SyntaxThemeOption,
  getSyntaxThemePair,
} from "@/components/theme/syntax-theme"

import type { RequestBodyLanguage } from "./request-formatters"

const highlightedLanguages = [
  "css",
  "html",
  "javascript",
  "json",
  "xml",
  "yaml",
] satisfies BundledLanguage[]

const highlighterPromise = createHighlighterCore({
  engine: createJavaScriptRegexEngine(),
  langs: highlightedLanguages.map((language) => bundledLanguages[language]),
  themes: toBundledThemeRegistrations(getSyntaxThemePair(DEFAULT_SYNTAX_THEME)),
})

const loadedSyntaxThemePromises = new Map<SyntaxThemeOption, Promise<void>>([
  [DEFAULT_SYNTAX_THEME, highlighterPromise.then(() => undefined)],
])

export async function highlightRequestBody({
  language,
  syntaxTheme = DEFAULT_SYNTAX_THEME,
  tabIndex,
  value,
}: {
  language: RequestBodyLanguage
  syntaxTheme?: SyntaxThemeOption
  tabIndex?: number | string | false
  value: string
}) {
  const shikiLanguage = toShikiLanguage(language)

  if (!shikiLanguage || !value) {
    return ""
  }

  const highlighter = await highlighterPromise
  await loadSyntaxTheme(syntaxTheme)
  const themes = getSyntaxThemePair(syntaxTheme)

  return highlighter.codeToHtml(value, {
    lang: shikiLanguage,
    tabindex: tabIndex,
    themes,
  })
}

async function loadSyntaxTheme(theme: SyntaxThemeOption) {
  const existingPromise = loadedSyntaxThemePromises.get(theme)

  if (existingPromise) {
    await existingPromise
    return
  }

  const loadPromise = highlighterPromise.then(async (highlighter) => {
    const loadedThemes = new Set(highlighter.getLoadedThemes())
    const unloadedThemes = Object.values(getSyntaxThemePair(theme)).filter(
      (themeName) => !loadedThemes.has(themeName)
    )

    if (unloadedThemes.length > 0) {
      await highlighter.loadTheme(
        ...unloadedThemes.map((themeName) => bundledThemes[themeName])
      )
    }
  })

  loadedSyntaxThemePromises.set(theme, loadPromise)

  try {
    await loadPromise
  } catch (error) {
    if (loadedSyntaxThemePromises.get(theme) === loadPromise) {
      loadedSyntaxThemePromises.delete(theme)
    }

    throw error
  }
}

function toShikiLanguage(
  language: RequestBodyLanguage
): BundledLanguage | null {
  return language === "text" ? null : language
}

function toBundledThemeRegistrations(themePair: {
  dark: keyof typeof bundledThemes
  light: keyof typeof bundledThemes
}) {
  return [bundledThemes[themePair.light], bundledThemes[themePair.dark]]
}
