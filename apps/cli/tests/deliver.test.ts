import { Buffer } from "node:buffer"
import { createServer, type Server } from "node:http"
import { type AddressInfo } from "node:net"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { deliverRequest, deliverWithRetry } from "../src/core/deliver.js"
import type { CapturedRequest } from "../src/core/types.js"

interface Received {
  method: string
  url: string
  headers: Record<string, string | string[] | undefined>
  body: string
}

let server: Server
let received: Received[]
let baseUrl: string

beforeEach(async () => {
  received = []
  server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk) => chunks.push(chunk as Buffer))
    req.on("end", () => {
      received.push({
        method: req.method ?? "",
        url: req.url ?? "",
        headers: req.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      })
      res.statusCode = 204
      res.end()
    })
  })

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${port}`
})

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

function makeRequest(
  overrides: Partial<CapturedRequest> = {}
): CapturedRequest {
  return {
    id: "11111111-1111-1111-8111-111111111111",
    endpointId: "22222222-2222-2222-8222-222222222222",
    method: "POST",
    url: "/created?x=1",
    path: "/created",
    query: { x: ["1"] },
    headers: { "content-type": "application/json", "x-signature": "sig" },
    bodyText: '{"ok":true}',
    bodyBase64: Buffer.from('{"ok":true}').toString("base64"),
    bodySize: 11,
    contentType: "application/json",
    receivedAt: "2026-06-13T12:00:00.000Z",
    ip: null,
    ...overrides,
  }
}

describe("deliverRequest", () => {
  it("delivers the method, mapped path, headers, and body to the local server", async () => {
    const result = await deliverRequest({
      request: makeRequest(),
      target: `${baseUrl}/api/stripe`,
      pathMode: "preserve",
      timeoutMs: 5000,
      signal: new AbortController().signal,
    })

    expect(result.outcome).toBe("responded")
    expect(result.status).toBe(204)
    expect(received).toHaveLength(1)
    expect(received[0]?.method).toBe("POST")
    expect(received[0]?.url).toBe("/api/stripe/created?x=1")
    expect(received[0]?.headers["x-signature"]).toBe("sig")
    expect(received[0]?.headers["x-webhookslol-request-id"]).toBe(
      "11111111-1111-1111-8111-111111111111"
    )
    expect(received[0]?.body).toBe('{"ok":true}')
  })

  it("reports a failed outcome when the target is unreachable", async () => {
    const result = await deliverRequest({
      request: makeRequest(),
      // Closed port: nothing is listening.
      target: "http://127.0.0.1:1/hook",
      pathMode: "strip",
      timeoutMs: 2000,
      signal: new AbortController().signal,
    })

    expect(result.outcome).toBe("failed")
    expect(result.error).toBeInstanceOf(Error)
  })
})

describe("deliverWithRetry", () => {
  it("does not retry a server that responds, even with 5xx", async () => {
    let retries = 0
    const result = await deliverWithRetry({
      request: makeRequest(),
      target: `${baseUrl}/`,
      pathMode: "strip",
      timeoutMs: 5000,
      maxRetries: 3,
      signal: new AbortController().signal,
      onRetry: () => {
        retries += 1
      },
    })

    expect(result.outcome).toBe("responded")
    expect(result.attempts).toBe(1)
    expect(retries).toBe(0)
  })
})
