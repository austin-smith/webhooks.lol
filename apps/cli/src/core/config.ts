import { isIP } from "node:net"

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
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return true
  }

  const address = normalizeIpLiteral(hostname)

  if (isIP(address) === 4) {
    return isAllowedIpv4Target(address)
  }

  if (isIP(address) === 6) {
    return isAllowedIpv6Target(address)
  }

  return false
}

function normalizeIpLiteral(hostname: string) {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname
}

function isAllowedIpv4Target(address: string): boolean {
  const octets = address.split(".").map((part) => Number(part))

  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false
  }

  const [first, second, third, fourth] = octets

  return (
    first === 10 ||
    first === 127 ||
    (first === 0 && second === 0 && third === 0 && fourth === 0) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

function isAllowedIpv6Target(address: string): boolean {
  if (address === "::1") {
    return true
  }

  const firstHextet = readFirstIpv6Hextet(address)

  if (firstHextet === null) {
    return false
  }

  return (
    // fc00::/7 unique local addresses.
    (firstHextet & 0xfe00) === 0xfc00 ||
    // fe80::/10 link-local addresses.
    (firstHextet & 0xffc0) === 0xfe80
  )
}

function readFirstIpv6Hextet(address: string): number | null {
  const [firstPart] = address.toLowerCase().split(":")

  if (!firstPart) {
    return 0
  }

  const parsed = Number.parseInt(firstPart, 16)

  return Number.isFinite(parsed) ? parsed : null
}
