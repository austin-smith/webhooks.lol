export const REQUEST_SEARCH_DOCS_PATH = "searching-requests#advanced-search"

export const FORWARDING_DOCS_PATH = "forwarding-requests"

export const CUSTOM_RESPONSE_DOCS_PATH = "custom-responses"

export function createDocsPageUrl(docsUrl: string | null, path: string) {
  if (!docsUrl) {
    return null
  }

  const baseUrl = docsUrl.endsWith("/") ? docsUrl : `${docsUrl}/`
  const normalizedPath = path.replace(/^\/+/, "")

  return new URL(normalizedPath, baseUrl).toString()
}
