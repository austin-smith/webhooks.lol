import { lookup as lookupDns } from "node:dns/promises"
import type { LookupAddress } from "node:dns"
import { BlockList, isIP } from "node:net"

export const ENDPOINT_FORWARDING_QUEUE = "endpoint-forward-delivery"

export const ENDPOINT_FORWARDING_RETRY_LIMIT = 8
export const ENDPOINT_FORWARDING_RETRY_DELAY_SECONDS = 30
export const ENDPOINT_FORWARDING_RETRY_DELAY_MAX_SECONDS = 60 * 60
export const ENDPOINT_FORWARDING_DELIVERY_TIMEOUT_MS = 10_000

export type EndpointForwardPathMode = "strip" | "preserve"

export type EndpointForwardDeliveryStatus =
  | "pending"
  | "delivered"
  | "failed"
  | "cancelled"

export type EndpointForwardDeliveryJob = {
  deliveryId: string
}

export type ResolvedEndpointForwardAddress = {
  address: string
  family: 4 | 6
}

export type ResolvedEndpointForwardTargetUrl = {
  addresses: ResolvedEndpointForwardAddress[]
  url: URL
}

export type EndpointForwardTargetResolver = (
  hostname: string
) => Promise<LookupAddress[]>

export class EndpointForwardTargetValidationError extends Error {
  readonly retryable: boolean

  constructor(message: string, { retryable = false } = {}) {
    super(message)
    this.name = "EndpointForwardTargetValidationError"
    this.retryable = retryable
  }
}

const blockedIpv4AddressRanges = new BlockList()
const blockedIpv6AddressRanges = new BlockList()

blockedIpv4AddressRanges.addSubnet("0.0.0.0", 8, "ipv4")
blockedIpv4AddressRanges.addSubnet("10.0.0.0", 8, "ipv4")
blockedIpv4AddressRanges.addSubnet("100.64.0.0", 10, "ipv4")
blockedIpv4AddressRanges.addSubnet("127.0.0.0", 8, "ipv4")
blockedIpv4AddressRanges.addSubnet("169.254.0.0", 16, "ipv4")
blockedIpv4AddressRanges.addSubnet("172.16.0.0", 12, "ipv4")
blockedIpv4AddressRanges.addSubnet("192.0.0.0", 24, "ipv4")
blockedIpv4AddressRanges.addSubnet("192.0.2.0", 24, "ipv4")
blockedIpv4AddressRanges.addSubnet("192.168.0.0", 16, "ipv4")
blockedIpv4AddressRanges.addSubnet("198.18.0.0", 15, "ipv4")
blockedIpv4AddressRanges.addSubnet("198.51.100.0", 24, "ipv4")
blockedIpv4AddressRanges.addSubnet("203.0.113.0", 24, "ipv4")
blockedIpv4AddressRanges.addSubnet("224.0.0.0", 4, "ipv4")
blockedIpv4AddressRanges.addSubnet("240.0.0.0", 4, "ipv4")
blockedIpv4AddressRanges.addAddress("255.255.255.255", "ipv4")

blockedIpv6AddressRanges.addAddress("::", "ipv6")
blockedIpv6AddressRanges.addAddress("::1", "ipv6")
blockedIpv6AddressRanges.addSubnet("::ffff:0:0", 96, "ipv6")
blockedIpv6AddressRanges.addSubnet("64:ff9b::", 96, "ipv6")
blockedIpv6AddressRanges.addSubnet("100::", 64, "ipv6")
blockedIpv6AddressRanges.addSubnet("2001::", 23, "ipv6")
blockedIpv6AddressRanges.addSubnet("2001:db8::", 32, "ipv6")
blockedIpv6AddressRanges.addSubnet("2002::", 16, "ipv6")
blockedIpv6AddressRanges.addSubnet("fc00::", 7, "ipv6")
blockedIpv6AddressRanges.addSubnet("fe80::", 10, "ipv6")
blockedIpv6AddressRanges.addSubnet("ff00::", 8, "ipv6")

export function parseEndpointForwardPathMode(
  value: string | undefined
): EndpointForwardPathMode {
  if (value === undefined || value === "strip") {
    return "strip"
  }

  if (value === "preserve") {
    return "preserve"
  }

  throw new EndpointForwardTargetValidationError(
    'Forward path mode must be "strip" or "preserve".'
  )
}

export function normalizeEndpointForwardTargetUrl(value: string): string {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new EndpointForwardTargetValidationError("Forward URL is invalid.")
  }

  if (url.protocol !== "https:") {
    throw new EndpointForwardTargetValidationError(
      "Forward URL must use HTTPS."
    )
  }

  if (url.username || url.password) {
    throw new EndpointForwardTargetValidationError(
      "Forward URL must not include credentials."
    )
  }

  url.hash = ""
  return url.toString()
}

export async function assertEndpointForwardTargetUrlCanBeReachedSafely(
  value: string,
  options?: {
    resolveHostname?: EndpointForwardTargetResolver
  }
): Promise<void> {
  await resolveEndpointForwardTargetUrlSafely(value, options)
}

export async function resolveEndpointForwardTargetUrlSafely(
  value: string,
  {
    resolveHostname = resolveEndpointForwardTargetHostname,
  }: {
    resolveHostname?: EndpointForwardTargetResolver
  } = {}
): Promise<ResolvedEndpointForwardTargetUrl> {
  const url = new URL(normalizeEndpointForwardTargetUrl(value))
  const hostname = normalizeUrlHostname(url.hostname)
  const hostAddressFamily = isIP(hostname)

  if (hostAddressFamily !== 0) {
    const family = parseAddressFamily(hostAddressFamily)

    assertAddressIsPublic(hostname, family)

    return {
      addresses: [{ address: hostname, family }],
      url,
    }
  }

  let addresses: LookupAddress[]

  try {
    addresses = await resolveHostname(hostname)
  } catch (error) {
    throw new EndpointForwardTargetValidationError(
      "Forward URL hostname did not resolve.",
      { retryable: isTransientDnsLookupError(error) }
    )
  }

  if (addresses.length === 0) {
    throw new EndpointForwardTargetValidationError(
      "Forward URL hostname did not resolve."
    )
  }

  for (const address of addresses) {
    assertAddressIsPublic(address.address, address.family)
  }

  return {
    addresses: addresses.map((address) => ({
      address: address.address,
      family: parseAddressFamily(address.family),
    })),
    url,
  }
}

function isTransientDnsLookupError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EAI_AGAIN" || error.code === "ETIMEOUT")
  )
}

function normalizeUrlHostname(hostname: string) {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname
}

async function resolveEndpointForwardTargetHostname(hostname: string) {
  return lookupDns(hostname, {
    all: true,
    verbatim: true,
  })
}

function assertAddressIsPublic(address: string, family: number): void {
  const normalizedFamily = parseAddressFamily(family)
  const blocked =
    normalizedFamily === 4
      ? blockedIpv4AddressRanges.check(address, "ipv4")
      : blockedIpv6AddressRanges.check(address, "ipv6")

  if (blocked) {
    throw new EndpointForwardTargetValidationError(
      "Forward URL must resolve to a public address."
    )
  }
}

function parseAddressFamily(family: number): 4 | 6 {
  if (family === 4 || family === 6) {
    return family
  }

  throw new EndpointForwardTargetValidationError(
    "Forward URL resolved to an unsupported address family."
  )
}
