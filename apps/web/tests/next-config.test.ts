import { afterEach, describe, expect, it, vi } from "vitest"
import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants"

afterEach(() => {
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

  it("does not rediscover build metadata when starting the built application", async () => {
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "develop")

    const { default: createNextConfig } = await import("../next.config")

    expect(createNextConfig(PHASE_PRODUCTION_SERVER).env).toBeUndefined()
  })
})
