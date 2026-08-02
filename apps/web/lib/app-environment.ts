import "server-only"

export const PRODUCTION_APP_ENV_NAME = "production"

const MAX_APP_ENV_NAME_LENGTH = 24
const APP_ENV_NAME_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/

export type AppEnvironment =
  | {
      kind: "production"
      name: typeof PRODUCTION_APP_ENV_NAME
    }
  | {
      kind: "non-production"
      name: string
    }
  | {
      issue: "invalid-format" | "missing" | "too-long"
      kind: "invalid"
    }

export function readAppEnvironment() {
  return parseAppEnvironment(process.env.APP_ENV)
}

export function parseAppEnvironment(value: string | undefined): AppEnvironment {
  if (value === undefined || value.length === 0) {
    return { issue: "missing", kind: "invalid" }
  }

  if (value.length > MAX_APP_ENV_NAME_LENGTH) {
    return { issue: "too-long", kind: "invalid" }
  }

  if (/\s/.test(value) || !APP_ENV_NAME_PATTERN.test(value)) {
    return { issue: "invalid-format", kind: "invalid" }
  }

  if (value === PRODUCTION_APP_ENV_NAME) {
    return { kind: "production", name: value }
  }

  return { kind: "non-production", name: value }
}
