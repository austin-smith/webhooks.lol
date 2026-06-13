import { Buffer } from "node:buffer"
import type { LookupAddress } from "node:dns"
import { request as requestHttps } from "node:https"
import type { LookupFunction } from "node:net"

import type { ResolvedEndpointForwardAddress } from "@/lib/webhooks/endpoint-forwarding/policy"

export type EndpointForwardTransport = (input: {
  addresses: ResolvedEndpointForwardAddress[]
  body: ArrayBuffer | undefined
  headers: Headers
  method: string
  signal: AbortSignal
  url: URL
}) => Promise<{ status: number }>

export function sendEndpointForwardHttpsRequest({
  addresses,
  body,
  headers,
  method,
  signal,
  url,
}: {
  addresses: ResolvedEndpointForwardAddress[]
  body: ArrayBuffer | undefined
  headers: Headers
  method: string
  signal: AbortSignal
  url: URL
}): Promise<{ status: number }> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("Endpoint forward delivery was aborted."))
      return
    }

    const requestBody = body ? Buffer.from(body) : undefined
    const request = requestHttps(
      url,
      {
        headers: headersToRecord(headers),
        lookup: createPinnedLookup(addresses),
        method,
      },
      (response) => {
        response.resume()
        response.on("end", () => {
          resolve({ status: response.statusCode ?? 0 })
        })
      }
    )
    const onAbort = () => {
      request.destroy(new Error("Endpoint forward delivery was aborted."))
    }

    signal.addEventListener("abort", onAbort, { once: true })
    request.on("error", reject)
    request.on("close", () => {
      signal.removeEventListener("abort", onAbort)
    })

    if (requestBody) {
      request.end(requestBody)
      return
    }

    request.end()
  })
}

function createPinnedLookup(
  addresses: ResolvedEndpointForwardAddress[]
): LookupFunction {
  return (_hostname, options, callback) => {
    if (addresses.length === 0) {
      callback(createNoAddressError(), "", 0)
      return
    }

    if (options.all) {
      callback(
        null,
        addresses.map(
          (address): LookupAddress => ({
            address: address.address,
            family: address.family,
          })
        )
      )
      return
    }

    const family = normalizeLookupFamily(options.family)
    const address =
      family === 0
        ? addresses[0]
        : addresses.find((candidate) => candidate.family === family)

    if (!address) {
      callback(createNoAddressError(), "", 0)
      return
    }

    callback(null, address.address, address.family)
  }
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {}

  headers.forEach((value, key) => {
    record[key] = value
  })

  return record
}

function normalizeLookupFamily(
  family: string | number | undefined
): 0 | 4 | 6 {
  if (family === 4 || family === "IPv4") {
    return 4
  }

  if (family === 6 || family === "IPv6") {
    return 6
  }

  return 0
}

function createNoAddressError(): NodeJS.ErrnoException {
  const error = new Error(
    "Forward URL did not resolve to a pinned address family."
  ) as NodeJS.ErrnoException
  error.code = "ENOTFOUND"
  return error
}
