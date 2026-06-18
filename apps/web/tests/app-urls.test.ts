import { afterEach, describe, expect, it, vi } from "vitest"

import { readAppUrl, readDocsUrl } from "@/lib/app-urls"

describe("app URL config", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe("readAppUrl", () => {
    it("requires the app URL", () => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "")

      expect(() => readAppUrl()).toThrow("NEXT_PUBLIC_APP_URL is required.")
    })

    it("normalizes the configured app URL", () => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", " http://localhost:4665 ")

      expect(readAppUrl().toString()).toBe("http://localhost:4665/")
    })

    it("rejects non-HTTP app URLs", () => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "ftp://localhost:4665")

      expect(() => readAppUrl()).toThrow(
        "NEXT_PUBLIC_APP_URL must be an HTTP(S) URL."
      )
    })

    it("rejects malformed app URLs", () => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "not a url")

      expect(() => readAppUrl()).toThrow(
        "NEXT_PUBLIC_APP_URL must be an HTTP(S) URL."
      )
    })
  })

  describe("readDocsUrl", () => {
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
})
