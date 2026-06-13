import { CliError } from "../cli-error.js"

export const DEFAULT_BASE_URL = "https://webhooks.lol"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Resolves the API origin from --host, then WEBHOOKS_LOL_URL, then the default.
export function resolveBaseUrl({
  hostFlag,
  env,
}: {
  hostFlag?: string
  env: NodeJS.ProcessEnv
}): string {
  const raw = hostFlag ?? env.WEBHOOKS_LOL_URL ?? DEFAULT_BASE_URL
  const url = parseHttpUrl(raw)

  if (!url) {
    throw new CliError(`Invalid host URL: ${raw}`)
  }

  return url.origin
}

// Validates the local forwarding target. Defaults to refusing non-local hosts
// so a copied command cannot be tricked into relaying traffic to a remote
// server; --allow-remote opts out.
export function resolveTarget({
  to,
  allowRemote,
}: {
  to: string | undefined
  allowRemote: boolean
}): string {
  if (!to) {
    throw new CliError(
      "Missing --to <url>: the local URL to forward requests to."
    )
  }

  const url = parseHttpUrl(to)
  if (!url) {
    throw new CliError(`Invalid --to URL: ${to}`)
  }

  if (!allowRemote && !isLocalHostname(url.hostname)) {
    throw new CliError(
      `--to host "${url.hostname}" is not local. Pass --allow-remote to forward to remote hosts.`
    )
  }

  return url.toString()
}

export function parseEndpointId(value: string | undefined): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw new CliError(`Invalid endpoint id: ${value ?? "(missing)"}`)
  }

  return value.toLowerCase()
}

export function parsePathMode(value: string | undefined): "preserve" | "strip" {
  if (value === undefined || value === "preserve") {
    return "preserve"
  }

  if (value === "strip") {
    return "strip"
  }

  throw new CliError(
    `Invalid --path mode "${value}". Use "preserve" or "strip".`
  )
}

export function parsePositiveInteger(
  value: string | undefined,
  { flag, fallback }: { flag: string; fallback: number }
): number {
  if (value === undefined) {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new CliError(
      `Invalid ${flag}: ${value}. Expected a non-negative integer.`
    )
  }

  return parsed
}

function parseHttpUrl(value: string): URL | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null
  }

  return url
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  )
}
