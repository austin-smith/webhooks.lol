import { afterEach, describe, expect, it, vi } from "vitest"
import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants"

afterEach(() => {
  vi.doUnmock("node:child_process")
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("Next.js build metadata", () => {
  it("maps Railway Git metadata into the application build contract", async () => {
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "develop")
    vi.stubEnv("RAILWAY_GIT_BRANCH", "environment-badge-build-details")
    vi.stubEnv(
      "RAILWAY_GIT_COMMIT_SHA",
      "d7090e7ca299692d9368afb9ad11058d957510ae"
    )
    vi.stubEnv(
      "RAILWAY_GIT_COMMIT_MESSAGE",
      "add environment badge build details\n\nAdditional body"
    )

    const { default: createNextConfig } = await import("../next.config")
    const nextConfig = createNextConfig(PHASE_PRODUCTION_BUILD)

    expect(nextConfig.env).toEqual({
      APP_BUILD_AT: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      APP_BUILD_BRANCH: "environment-badge-build-details",
      APP_BUILD_COMMIT_SHA: "d7090e7ca299692d9368afb9ad11058d957510ae",
      APP_BUILD_COMMIT_SUBJECT: "add environment badge build details",
      APP_BUILD_DIRTY: "false",
    })
  })

  it("rejects a Railway build with missing Git metadata", async () => {
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "develop")
    vi.stubEnv("RAILWAY_GIT_BRANCH", "environment-badge-build-details")
    vi.stubEnv("RAILWAY_GIT_COMMIT_SHA", "")
    vi.stubEnv("RAILWAY_GIT_COMMIT_MESSAGE", "add environment badge details")

    const { default: createNextConfig } = await import("../next.config")

    expect(() => createNextConfig(PHASE_PRODUCTION_BUILD)).toThrow(
      "RAILWAY_GIT_COMMIT_SHA is required during Railway builds"
    )
  })

  it("uses the source branch and checked-out commit for GitHub pull request builds", async () => {
    mockGit({
      "rev-parse HEAD": "b5ef55bb4c6afa4ca1c701a332fc7cfd6ecce396",
      "log -1 --format=%s HEAD": "Merge pull request test commit",
      "status --porcelain=v1": "",
    })
    vi.stubEnv("GITHUB_ACTIONS", "true")
    vi.stubEnv("GITHUB_EVENT_NAME", "pull_request")
    vi.stubEnv("GITHUB_HEAD_REF", "environment-badge-build-details")

    const { default: createNextConfig } = await import("../next.config")

    expect(createNextConfig(PHASE_PRODUCTION_BUILD).env).toMatchObject({
      APP_BUILD_BRANCH: "environment-badge-build-details",
      APP_BUILD_COMMIT_SHA: "b5ef55bb4c6afa4ca1c701a332fc7cfd6ecce396",
      APP_BUILD_COMMIT_SUBJECT: "Merge pull request test commit",
      APP_BUILD_DIRTY: "false",
    })
  })

  it("uses the branch ref and checked-out commit for GitHub branch builds", async () => {
    mockGit({
      "rev-parse HEAD": "b8bd3b0afa68d62a0a4882069cdc931389325ef3",
      "log -1 --format=%s HEAD": "pass railway provenance to typegen",
      "status --porcelain=v1": "",
    })
    vi.stubEnv("GITHUB_ACTIONS", "true")
    vi.stubEnv("GITHUB_EVENT_NAME", "push")
    vi.stubEnv("GITHUB_REF_NAME", "main")
    vi.stubEnv("GITHUB_REF_TYPE", "branch")

    const { default: createNextConfig } = await import("../next.config")

    expect(createNextConfig(PHASE_PRODUCTION_BUILD).env).toMatchObject({
      APP_BUILD_BRANCH: "main",
      APP_BUILD_COMMIT_SHA: "b8bd3b0afa68d62a0a4882069cdc931389325ef3",
      APP_BUILD_COMMIT_SUBJECT: "pass railway provenance to typegen",
      APP_BUILD_DIRTY: "false",
    })
  })

  it("rejects GitHub pull request builds without a source branch", async () => {
    vi.stubEnv("GITHUB_ACTIONS", "true")
    vi.stubEnv("GITHUB_EVENT_NAME", "pull_request")
    vi.stubEnv("GITHUB_HEAD_REF", "")

    const { default: createNextConfig } = await import("../next.config")

    expect(() => createNextConfig(PHASE_PRODUCTION_BUILD)).toThrow(
      "GITHUB_HEAD_REF is required during GitHub Actions builds"
    )
  })

  it("rejects GitHub Actions builds for non-branch refs", async () => {
    vi.stubEnv("GITHUB_ACTIONS", "true")
    vi.stubEnv("GITHUB_EVENT_NAME", "push")
    vi.stubEnv("GITHUB_REF_NAME", "v1.0.0")
    vi.stubEnv("GITHUB_REF_TYPE", "tag")

    const { default: createNextConfig } = await import("../next.config")

    expect(() => createNextConfig(PHASE_PRODUCTION_BUILD)).toThrow(
      "GitHub Actions event push must build a branch, received ref type tag"
    )
  })

  it("rejects ambiguous deployment-provider signals", async () => {
    vi.stubEnv("GITHUB_ACTIONS", "true")
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "develop")

    const { default: createNextConfig } = await import("../next.config")

    expect(() => createNextConfig(PHASE_PRODUCTION_BUILD)).toThrow(
      "Railway and GitHub Actions build signals cannot both be set"
    )
  })

  it("rejects detached local Git builds", async () => {
    mockGit({ "branch --show-current": "" })

    const { default: createNextConfig } = await import("../next.config")

    expect(() => createNextConfig(PHASE_PRODUCTION_BUILD)).toThrow(
      "Local Git builds require an attached branch"
    )
  })

  it("does not rediscover build metadata when starting the built application", async () => {
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "develop")

    const { default: createNextConfig } = await import("../next.config")

    expect(createNextConfig(PHASE_PRODUCTION_SERVER).env).toBeUndefined()
  })
})

function mockGit(results: Record<string, string>) {
  vi.doMock("node:child_process", () => ({
    execFileSync: (_file: string, args: readonly string[]) => {
      const command = args.join(" ")
      const result = results[command]

      if (result === undefined) {
        throw new Error(`Unexpected Git command: ${command}`)
      }

      return result
    },
  }))
}
