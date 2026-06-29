export function readAppUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim()

  if (!value) {
    throw new Error("NEXT_PUBLIC_APP_URL is required.")
  }

  return parseHttpUrl(value, "NEXT_PUBLIC_APP_URL")
}

export function readDocsUrl() {
  const value = process.env.NEXT_PUBLIC_DOCS_URL?.trim()

  if (!value) {
    throw new Error("NEXT_PUBLIC_DOCS_URL is required.")
  }

  return parseHttpUrl(value, "NEXT_PUBLIC_DOCS_URL")
}

function parseHttpUrl(value: string, name: string) {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be an HTTP(S) URL.`)
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${name} must be an HTTP(S) URL.`)
  }

  return url
}
