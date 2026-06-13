import { describe, expect, it } from "vitest"

import { CliError } from "../src/cli-error.js"
import {
  parsePathMode,
  parsePositiveInteger,
  resolveBaseUrl,
  resolveTarget,
} from "../src/core/config.js"

describe("resolveBaseUrl", () => {
  it("prefers the flag over the env and default", () => {
    expect(
      resolveBaseUrl({
        hostFlag: "http://localhost:4665",
        env: { WEBHOOKS_LOL_URL: "https://env.example" },
      })
    ).toBe("http://localhost:4665")
  })

  it("falls back to the env variable", () => {
    expect(
      resolveBaseUrl({ env: { WEBHOOKS_LOL_URL: "https://env.example" } })
    ).toBe("https://env.example")
  })

  it("defaults to the public host", () => {
    expect(resolveBaseUrl({ env: {} })).toBe("https://webhooks.lol")
  })

  it("rejects non-http protocols", () => {
    expect(() => resolveBaseUrl({ hostFlag: "ftp://x", env: {} })).toThrow(
      CliError
    )
  })
})

describe("resolveTarget", () => {
  it("accepts a localhost target", () => {
    expect(
      resolveTarget({ to: "http://localhost:3000/hook", allowRemote: false })
    ).toBe("http://localhost:3000/hook")
  })

  it("accepts private network ranges", () => {
    expect(
      resolveTarget({ to: "http://192.168.1.10/hook", allowRemote: false })
    ).toContain("192.168.1.10")
  })

  it("rejects a remote target without --allow-remote", () => {
    expect(() =>
      resolveTarget({ to: "https://evil.example/hook", allowRemote: false })
    ).toThrow(/not local/)
  })

  it("allows a remote target with --allow-remote", () => {
    expect(
      resolveTarget({ to: "https://api.example/hook", allowRemote: true })
    ).toContain("api.example")
  })

  it("requires a target", () => {
    expect(() => resolveTarget({ to: undefined, allowRemote: false })).toThrow(
      CliError
    )
  })
})

describe("parsePathMode", () => {
  it("defaults to preserve", () => {
    expect(parsePathMode(undefined)).toBe("preserve")
  })

  it("accepts strip", () => {
    expect(parsePathMode("strip")).toBe("strip")
  })

  it("rejects unknown modes", () => {
    expect(() => parsePathMode("nope")).toThrow(CliError)
  })
})

describe("parsePositiveInteger", () => {
  it("returns the fallback when missing", () => {
    expect(
      parsePositiveInteger(undefined, { flag: "--timeout", fallback: 30 })
    ).toBe(30)
  })

  it("parses a valid integer", () => {
    expect(parsePositiveInteger("5", { flag: "--retries", fallback: 1 })).toBe(
      5
    )
  })

  it("rejects negatives and non-integers", () => {
    expect(() =>
      parsePositiveInteger("-1", { flag: "--retries", fallback: 1 })
    ).toThrow(CliError)
    expect(() =>
      parsePositiveInteger("1.5", { flag: "--retries", fallback: 1 })
    ).toThrow(CliError)
  })
})
