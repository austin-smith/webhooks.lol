import { afterEach, describe, expect, it, vi } from "vitest"

import { parseAppEnvironment, readAppEnvironment } from "@/lib/app-environment"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("parseAppEnvironment", () => {
  it.each([undefined, ""])("classifies a missing value as invalid", (value) => {
    expect(parseAppEnvironment(value)).toEqual({
      issue: "missing",
      kind: "invalid",
    })
  })

  it("recognizes only the exact production environment", () => {
    expect(parseAppEnvironment("production")).toEqual({
      kind: "production",
      name: "production",
    })
  })

  it.each(["development", "develop", "staging", "review_branch", "pr-42"])(
    "accepts the non-production identifier %s",
    (name) => {
      expect(parseAppEnvironment(name)).toEqual({
        kind: "non-production",
        name,
      })
    }
  )

  it.each([
    "review branch",
    "-develop",
    "develop-",
    "review--branch",
    "review__branch",
    " production ",
    "production\n",
    "   ",
    "Production",
    "staging\nbcc",
  ])("rejects the malformed identifier %j", (value) => {
    expect(parseAppEnvironment(value)).toEqual({
      issue: "invalid-format",
      kind: "invalid",
    })
  })

  it("rejects identifiers longer than 24 characters", () => {
    expect(parseAppEnvironment("a".repeat(24))).toEqual({
      kind: "non-production",
      name: "a".repeat(24),
    })
    expect(parseAppEnvironment("a".repeat(25))).toEqual({
      issue: "too-long",
      kind: "invalid",
    })
  })
})

describe("readAppEnvironment", () => {
  it("reads APP_ENV from the server environment", () => {
    vi.stubEnv("APP_ENV", "staging")

    expect(readAppEnvironment()).toEqual({
      kind: "non-production",
      name: "staging",
    })
  })
})
