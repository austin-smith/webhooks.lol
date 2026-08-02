import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"

import { parseAppBuildMetadata } from "./lib/app-build-metadata"

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url))
const buildMetadata =
  readConfiguredBuildMetadata() ?? discoverGitBuildMetadata()

const nextConfig: NextConfig = {
  env: buildMetadata
    ? {
        APP_BUILD_AT: buildMetadata.builtAt,
        APP_BUILD_BRANCH: buildMetadata.branch,
        APP_BUILD_COMMIT_SHA: buildMetadata.commitSha,
        APP_BUILD_COMMIT_SUBJECT: buildMetadata.commitSubject,
        APP_BUILD_DIRTY: String(buildMetadata.dirty),
      }
    : {},
  poweredByHeader: false,
  transpilePackages: [
    "@webhooks-lol/database",
    "@webhooks-lol/webhooks-core",
    "@webhooks-lol/webhooks-server",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ]
  },
}

export default nextConfig

function readConfiguredBuildMetadata() {
  const configuredMetadata = {
    branch: process.env.APP_BUILD_BRANCH,
    builtAt: process.env.APP_BUILD_AT,
    commitSha: process.env.APP_BUILD_COMMIT_SHA,
    commitSubject: process.env.APP_BUILD_COMMIT_SUBJECT,
    dirty: process.env.APP_BUILD_DIRTY,
  }

  if (Object.values(configuredMetadata).every((value) => value === undefined)) {
    return null
  }

  return parseAppBuildMetadata({
    ...configuredMetadata,
    builtAt: configuredMetadata.builtAt ?? new Date().toISOString(),
    dirty: configuredMetadata.dirty ?? "false",
  })
}

function discoverGitBuildMetadata() {
  try {
    return parseAppBuildMetadata({
      branch: runGit(["rev-parse", "--abbrev-ref", "HEAD"]),
      builtAt: new Date().toISOString(),
      commitSha: runGit(["rev-parse", "HEAD"]),
      commitSubject: runGit(["log", "-1", "--format=%s"]),
      dirty: String(runGit(["status", "--porcelain=v1"]).length > 0),
    })
  } catch {
    return null
  }
}

function runGit(args: string[]) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim()
}
