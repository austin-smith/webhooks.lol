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

  it("accepts local and private IP literal targets", () => {
    const targets = [
      "http://127.0.0.1:3000/hook",
      "http://0.0.0.0:3000/hook",
      "http://10.1.2.3/hook",
      "http://172.16.0.1/hook",
      "http://172.31.255.255/hook",
      "http://192.168.1.10/hook",
      "http://[::1]:3000/hook",
      "http://[fc00::1]/hook",
      "http://[fd12:3456::1]/hook",
      "http://[fe80::1]/hook",
    ]

    for (const to of targets) {
      expect(resolveTarget({ to, allowRemote: false })).toContain("/hook")
    }
  })

  it("rejects DNS names that only look like private IP ranges", () => {
    const targets = [
      "http://10.attacker.example/hook",
      "http://172.16.attacker.example/hook",
      "http://192.168.attacker.example/hook",
      "http://127.0.0.1.attacker.example/hook",
      "http://0.0.0.0.attacker.example/hook",
    ]

    for (const to of targets) {
      expect(() => resolveTarget({ to, allowRemote: false })).toThrow(
        /not local/
      )
    }
  })

  it("rejects public IP literal targets without --allow-remote", () => {
    expect(() =>
      resolveTarget({ to: "http://8.8.8.8/hook", allowRemote: false })
    ).toThrow(/not local/)
    expect(() =>
      resolveTarget({ to: "http://0.1.2.3/hook", allowRemote: false })
    ).toThrow(/not local/)
    expect(() =>
      resolveTarget({ to: "http://172.15.255.255/hook", allowRemote: false })
    ).toThrow(/not local/)
    expect(() =>
      resolveTarget({ to: "http://172.32.0.0/hook", allowRemote: false })
    ).toThrow(/not local/)
    expect(() =>
      resolveTarget({
        to: "http://[2001:4860:4860::8888]/hook",
        allowRemote: false,
      })
    ).toThrow(/not local/)
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
