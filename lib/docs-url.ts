import "server-only"

export function readDocsUrl() {
  const value = process.env.NEXT_PUBLIC_DOCS_URL?.trim()

  if (!value) {
    return null
  }

  let docsUrl: URL

  try {
    docsUrl = new URL(value)
  } catch {
    throw new Error("NEXT_PUBLIC_DOCS_URL must be an HTTP(S) URL.")
  }

  if (docsUrl.protocol !== "http:" && docsUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_DOCS_URL must be an HTTP(S) URL.")
  }

  return docsUrl.toString()
}
