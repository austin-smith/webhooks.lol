import { isValid, parseISO } from "date-fns"

export type AppBuildMetadata = {
  branch: string
  builtAt: string
  commitSha: string
  commitSubject: string
  dirty: boolean
}

type AppBuildMetadataInput = {
  branch: string | undefined
  builtAt: string | undefined
  commitSha: string | undefined
  commitSubject: string | undefined
  dirty: string | undefined
}

const COMMIT_SHA_PATTERN = /^[0-9a-f]{7,64}$/i
const ISO_8601_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

export function parseAppBuildMetadata(
  input: AppBuildMetadataInput
): AppBuildMetadata {
  const branch = requireValue("APP_BUILD_BRANCH", input.branch)
  const builtAt = requireValue("APP_BUILD_AT", input.builtAt)
  const commitSha = requireValue("APP_BUILD_COMMIT_SHA", input.commitSha)
  const commitSubject = requireValue(
    "APP_BUILD_COMMIT_SUBJECT",
    input.commitSubject
  )

  if (!COMMIT_SHA_PATTERN.test(commitSha)) {
    throw new Error("APP_BUILD_COMMIT_SHA must be a Git commit SHA")
  }

  if (
    !ISO_8601_TIMESTAMP_PATTERN.test(builtAt) ||
    !isValid(parseISO(builtAt))
  ) {
    throw new Error("APP_BUILD_AT must be an ISO 8601 timestamp")
  }

  if (input.dirty !== "false" && input.dirty !== "true") {
    throw new Error('APP_BUILD_DIRTY must be either "true" or "false"')
  }

  return {
    branch,
    builtAt,
    commitSha,
    commitSubject,
    dirty: input.dirty === "true",
  }
}

export function parseOptionalAppBuildMetadata(
  input: AppBuildMetadataInput
): AppBuildMetadata | null {
  const values = Object.values(input)

  if (values.every((value) => value === undefined)) {
    return null
  }

  return parseAppBuildMetadata(input)
}

function requireValue(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`${name} is required`)
  }

  return value
}
