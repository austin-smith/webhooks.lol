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
  themes: [bundledThemes["vitesse-light"], bundledThemes["vitesse-dark"]],
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
      dark: "vitesse-dark",
      light: "vitesse-light",
    },
  })
}

function toShikiLanguage(
  language: RequestBodyLanguage
): BundledLanguage | null {
  return language === "text" ? null : language
}
