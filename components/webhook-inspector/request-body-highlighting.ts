import type { BundledLanguage } from "shiki"
import { createHighlighterCore } from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"
import { bundledLanguages } from "shiki/langs"
import { bundledThemes } from "shiki/themes"

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
  themes: [bundledThemes["light-plus"], bundledThemes["dark-plus"]],
})

export async function highlightRequestBody({
  language,
  value,
}: {
  language: RequestBodyLanguage
  value: string
}) {
  const shikiLanguage = toShikiLanguage(language)

  if (!shikiLanguage || !value) {
    return ""
  }

  const highlighter = await highlighterPromise

  return highlighter.codeToHtml(value, {
    lang: shikiLanguage,
    themes: {
      dark: "dark-plus",
      light: "light-plus",
    },
  })
}

function toShikiLanguage(
  language: RequestBodyLanguage
): BundledLanguage | null {
  return language === "text" ? null : language
}
