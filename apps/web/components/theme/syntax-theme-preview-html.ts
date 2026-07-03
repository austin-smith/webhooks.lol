import {
  SYNTAX_THEME_PREVIEW_CODE,
  type SyntaxThemeOption,
} from "@/components/theme/syntax-theme"
import { highlightRequestBody } from "@/components/webhook-inspector/request-body-highlighting"

const previewHtmlPromises = new Map<SyntaxThemeOption, Promise<string>>()

// Shared by the account page (server) and the client preview so both render
// the preview identically; the cache holds one entry per theme on each side.
export function getSyntaxThemePreviewHtml(syntaxTheme: SyntaxThemeOption) {
  const cachedPromise = previewHtmlPromises.get(syntaxTheme)

  if (cachedPromise) {
    return cachedPromise
  }

  const htmlPromise = highlightRequestBody({
    language: "json",
    syntaxTheme,
    tabIndex: false,
    value: SYNTAX_THEME_PREVIEW_CODE,
  })

  previewHtmlPromises.set(syntaxTheme, htmlPromise)

  htmlPromise.catch(() => {
    // Evict rejected promises so a later attempt can retry.
    if (previewHtmlPromises.get(syntaxTheme) === htmlPromise) {
      previewHtmlPromises.delete(syntaxTheme)
    }
  })

  return htmlPromise
}
