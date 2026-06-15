import { afterEach, describe, expect, it, vi } from "vitest"

import { readDocsUrl } from "@/lib/docs-url"

describe("docs URL config", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns null when the docs URL is not configured", () => {
    vi.stubEnv("NEXT_PUBLIC_DOCS_URL", "")

    expect(readDocsUrl()).toBeNull()
  })

  it("normalizes the configured docs URL", () => {
    vi.stubEnv("NEXT_PUBLIC_DOCS_URL", " http://localhost:4666 ")

    expect(readDocsUrl()).toBe("http://localhost:4666/")
  })

  it("rejects non-HTTP docs URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_DOCS_URL", "ftp://localhost:4666")

    expect(() => readDocsUrl()).toThrow(
      "NEXT_PUBLIC_DOCS_URL must be an HTTP(S) URL."
    )
  })

  it("rejects malformed docs URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_DOCS_URL", "not a url")

    expect(() => readDocsUrl()).toThrow(
      "NEXT_PUBLIC_DOCS_URL must be an HTTP(S) URL."
    )
  })
})
