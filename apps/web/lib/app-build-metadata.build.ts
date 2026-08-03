import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import { parseAppBuildMetadata } from "./app-build-metadata"

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url))

export function discoverAppBuildMetadata() {
  const isRailwayBuild = process.env.RAILWAY_ENVIRONMENT_NAME !== undefined
  const isGitHubActionsBuild = process.env.GITHUB_ACTIONS !== undefined

  if (isRailwayBuild && isGitHubActionsBuild) {
    throw new Error(
      "Railway and GitHub Actions build signals cannot both be set"
    )
  }

  if (isRailwayBuild) {
    return readRailwayBuildMetadata()
  }

  if (isGitHubActionsBuild) {
    return readGitHubActionsBuildMetadata()
  }

  return readLocalGitBuildMetadata()
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

function readGitHubActionsBuildMetadata() {
  const githubActions = readRequiredGitHubActionsVariable("GITHUB_ACTIONS")

  if (githubActions !== "true") {
    throw new Error(
      'GITHUB_ACTIONS must be "true" during GitHub Actions builds'
    )
  }

  return readGitCheckoutBuildMetadata(readGitHubActionsBranch())
}

function readGitHubActionsBranch() {
  const eventName = readRequiredGitHubActionsVariable("GITHUB_EVENT_NAME")

  if (eventName === "pull_request") {
    return readRequiredGitHubActionsVariable("GITHUB_HEAD_REF")
  }

  const refType = readRequiredGitHubActionsVariable("GITHUB_REF_TYPE")

  if (refType !== "branch") {
    throw new Error(
      `GitHub Actions event ${eventName} must build a branch, received ref type ${refType}`
    )
  }

  return readRequiredGitHubActionsVariable("GITHUB_REF_NAME")
}

function readLocalGitBuildMetadata() {
  const branch = runGit(["branch", "--show-current"])

  if (!branch) {
    throw new Error("Local Git builds require an attached branch")
  }

  return readGitCheckoutBuildMetadata(branch)
}

function readGitCheckoutBuildMetadata(branch: string) {
  return parseAppBuildMetadata({
    branch,
    builtAt: new Date().toISOString(),
    commitSha: runGit(["rev-parse", "HEAD"]),
    commitSubject: runGit(["log", "-1", "--format=%s", "HEAD"]),
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

function readRequiredGitHubActionsVariable(
  name:
    | "GITHUB_ACTIONS"
    | "GITHUB_EVENT_NAME"
    | "GITHUB_HEAD_REF"
    | "GITHUB_REF_NAME"
    | "GITHUB_REF_TYPE"
) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required during GitHub Actions builds`)
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
