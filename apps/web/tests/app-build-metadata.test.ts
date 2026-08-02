import { describe, expect, it } from "vitest"

import {
  parseAppBuildMetadata,
  parseOptionalAppBuildMetadata,
} from "@/lib/app-build-metadata"

const validInput = {
  branch: "env-badge",
  builtAt: "2026-08-02T20:25:00.000Z",
  commitSha: "0b194d4d5e6f7890abcdef1234567890abcdef12",
  commitSubject: "Add environment build details",
  dirty: "true",
}

describe("parseAppBuildMetadata", () => {
  it("parses a valid metadata snapshot", () => {
    expect(parseAppBuildMetadata(validInput)).toEqual({
      branch: "env-badge",
      builtAt: "2026-08-02T20:25:00.000Z",
      commitSha: "0b194d4d5e6f7890abcdef1234567890abcdef12",
      commitSubject: "Add environment build details",
      dirty: true,
    })
  })

  it.each([
    ["branch", { branch: undefined }, "APP_BUILD_BRANCH is required"],
    [
      "commit SHA",
      { commitSha: "not-a-sha" },
      "APP_BUILD_COMMIT_SHA must be a Git commit SHA",
    ],
    [
      "build timestamp",
      { builtAt: "not-a-date" },
      "APP_BUILD_AT must be an ISO 8601 timestamp",
    ],
    [
      "non-ISO build timestamp",
      { builtAt: "August 2, 2026" },
      "APP_BUILD_AT must be an ISO 8601 timestamp",
    ],
    [
      "impossible build date",
      { builtAt: "2026-02-30T12:00:00Z" },
      "APP_BUILD_AT must be an ISO 8601 timestamp",
    ],
    [
      "dirty flag",
      { dirty: "yes" },
      'APP_BUILD_DIRTY must be either "true" or "false"',
    ],
  ])("rejects an invalid %s", (_name, override, message) => {
    expect(() => parseAppBuildMetadata({ ...validInput, ...override })).toThrow(
      message
    )
  })
})

describe("parseOptionalAppBuildMetadata", () => {
  it("returns null when build metadata is entirely unavailable", () => {
    expect(
      parseOptionalAppBuildMetadata({
        branch: undefined,
        builtAt: undefined,
        commitSha: undefined,
        commitSubject: undefined,
        dirty: undefined,
      })
    ).toBeNull()
  })

  it("rejects a partial metadata snapshot", () => {
    expect(() =>
      parseOptionalAppBuildMetadata({
        branch: "env-badge",
        builtAt: undefined,
        commitSha: undefined,
        commitSubject: undefined,
        dirty: undefined,
      })
    ).toThrow("APP_BUILD_AT is required")
  })
})
