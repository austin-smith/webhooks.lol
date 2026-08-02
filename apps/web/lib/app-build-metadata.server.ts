import "server-only"

import { parseOptionalAppBuildMetadata } from "./app-build-metadata"

export function readAppBuildMetadata() {
  return parseOptionalAppBuildMetadata({
    branch: process.env.APP_BUILD_BRANCH,
    builtAt: process.env.APP_BUILD_AT,
    commitSha: process.env.APP_BUILD_COMMIT_SHA,
    commitSubject: process.env.APP_BUILD_COMMIT_SUBJECT,
    dirty: process.env.APP_BUILD_DIRTY,
  })
}
