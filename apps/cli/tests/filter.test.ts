import { Buffer } from "node:buffer"

import { describe, expect, it } from "vitest"

import {
  createFilter,
  filterIsActive,
  matchesFilter,
} from "../src/core/filter.js"
import type { CapturedRequest } from "../src/core/types.js"

function makeRequest(
  overrides: Partial<CapturedRequest> = {}
): CapturedRequest {
  return {
    id: "1",
    endpointId: "e",
    method: "POST",
    url: "/payments/created",
    path: "/payments/created",
    query: {},
    headers: {},
    bodyText: '{"type":"payment_intent.succeeded"}',
    bodyBase64: Buffer.from('{"type":"payment_intent.succeeded"}').toString(
      "base64"
    ),
    bodySize: 0,
    contentType: "application/json",
    receivedAt: "2026-06-13T12:00:00.000Z",
    ip: null,
    ...overrides,
  }
}

describe("matchesFilter", () => {
  it("matches everything when inactive", () => {
    const filter = createFilter({ methods: [], grep: null })
    expect(filterIsActive(filter)).toBe(false)
    expect(matchesFilter(makeRequest(), filter)).toBe(true)
  })

  it("filters by method case-insensitively", () => {
    const filter = createFilter({ methods: ["post"], grep: null })
    expect(matchesFilter(makeRequest({ method: "POST" }), filter)).toBe(true)
    expect(matchesFilter(makeRequest({ method: "GET" }), filter)).toBe(false)
  })

  it("greps path, url, and body", () => {
    const filter = createFilter({ methods: [], grep: "payment_intent" })
    expect(matchesFilter(makeRequest(), filter)).toBe(true)
    expect(
      matchesFilter(
        makeRequest({ bodyText: "", path: "/other", url: "/other" }),
        filter
      )
    ).toBe(false)
  })

  it("requires all active conditions to pass", () => {
    const filter = createFilter({ methods: ["POST"], grep: "refund" })
    expect(matchesFilter(makeRequest(), filter)).toBe(false)
  })
})
