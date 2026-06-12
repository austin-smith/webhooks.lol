export const REQUEST_SEARCH_DOCS_PATH = "searching-requests#advanced-search"

export function createDocsPageUrl(docsUrl: string | null, path: string) {
  if (!docsUrl) {
    return null
  }

  const baseUrl = docsUrl.endsWith("/") ? docsUrl : `${docsUrl}/`
  const normalizedPath = path.replace(/^\/+/, "")

  return new URL(normalizedPath, baseUrl).toString()
}
