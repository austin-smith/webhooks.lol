import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  type PHASE_TYPE,
} from "next/constants"

import { parseAppBuildMetadata } from "./lib/app-build-metadata"

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url))

export default function createNextConfig(phase: PHASE_TYPE): NextConfig {
  const buildMetadata = embedsBuildMetadata(phase) ? readBuildMetadata() : null

  return {
    env: buildMetadata
      ? {
          APP_BUILD_AT: buildMetadata.builtAt,
          APP_BUILD_BRANCH: buildMetadata.branch,
          APP_BUILD_COMMIT_SHA: buildMetadata.commitSha,
          APP_BUILD_COMMIT_SUBJECT: buildMetadata.commitSubject,
          APP_BUILD_DIRTY: String(buildMetadata.dirty),
        }
      : undefined,
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
}

function embedsBuildMetadata(phase: PHASE_TYPE) {
  return phase === PHASE_DEVELOPMENT_SERVER || phase === PHASE_PRODUCTION_BUILD
}

function readBuildMetadata() {
  return process.env.RAILWAY_ENVIRONMENT_NAME !== undefined
    ? readRailwayBuildMetadata()
    : readGitBuildMetadata()
}

function readRailwayBuildMetadata() {
  return parseAppBuildMetadata({
    branch: readRequiredRailwayGitVariable("RAILWAY_GIT_BRANCH"),
    builtAt: new Date().toISOString(),
    commitSha: readRequiredRailwayGitVariable("RAILWAY_GIT_COMMIT_SHA"),
    commitSubject: readRequiredRailwayGitVariable(
      "RAILWAY_GIT_COMMIT_MESSAGE"
    ).split("\n", 1)[0],
    dirty: "false",
  })
}

function readGitBuildMetadata() {
  return parseAppBuildMetadata({
    branch: runGit(["rev-parse", "--abbrev-ref", "HEAD"]),
    builtAt: new Date().toISOString(),
    commitSha: runGit(["rev-parse", "HEAD"]),
    commitSubject: runGit(["log", "-1", "--format=%s"]),
    dirty: String(runGit(["status", "--porcelain=v1"]).length > 0),
  })
}

function readRequiredRailwayGitVariable(
  name:
    | "RAILWAY_GIT_BRANCH"
    | "RAILWAY_GIT_COMMIT_MESSAGE"
    | "RAILWAY_GIT_COMMIT_SHA"
) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required during Railway builds`)
  }

  return value
}

function runGit(args: string[]) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim()
}
