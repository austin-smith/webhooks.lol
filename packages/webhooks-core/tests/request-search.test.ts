import { describe, expect, it } from "vitest"

import {
  EMPTY_REQUEST_SEARCH,
  parseAdvancedRequestSearchQuery,
  parseRequestSearchCriteria,
  requestMatchesSearch,
  requestSearchIsActive,
  serializeRequestSearchCriteria,
} from "@webhooks-lol/webhooks-core/request-search"
import type { CapturedRequest } from "@webhooks-lol/webhooks-core/types"

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"

function createRequest(overrides: Partial<CapturedRequest> = {}) {
  return {
    id: "captured-1",
    endpointId: ENDPOINT_ID,
    method: "POST",
    url: "/payments/created?source=stripe",
    path: "/payments/created",
    query: {
      source: ["stripe"],
    },
    headers: {
      "content-type": "application/json",
      "x-request-id": "req_123",
    },
    bodyText: '{"event":"payment.created","amount":42}',
    bodyBase64: "eyJldmVudCI6InBheW1lbnQuY3JlYXRlZCIsImFtb3VudCI6NDJ9",
    bodySize: 39,
    contentType: "application/json",
    receivedAt: "2026-06-05T00:00:00.000Z",
    ip: "203.0.113.7",
    ...overrides,
  } satisfies CapturedRequest
}

describe("request search", () => {
  it("normalizes request search criteria", () => {
    expect(
      parseRequestSearchCriteria({
        methods: ["post", "POST", "get"],
        conditions: [
          { field: "path", value: "  payments   created  " },
          { field: "url", value: "" },
          { field: "body", value: "stripe" },
        ],
      })
    ).toEqual({
      kind: "valid",
      value: {
        mode: "basic",
        methods: ["POST", "GET"],
        conditions: [
          { field: "path", value: "payments created" },
          { field: "body", value: "stripe" },
        ],
      },
    })
  })

  it("rejects invalid search criteria at the boundary", () => {
    expect(
      parseRequestSearchCriteria({
        methods: ["POST;DROP"],
      })
    ).toEqual({
      kind: "invalid",
      error: "Request methods must contain only letters, numbers, or hyphens.",
    })

    expect(
      parseRequestSearchCriteria({
        conditions: [{ field: "everything", value: "stripe" }],
      })
    ).toEqual({
      kind: "invalid",
      error: "Request search field is invalid.",
    })

    expect(
      parseRequestSearchCriteria({
        conditions: Array.from({ length: 9 }, (_value, index) => ({
          field: "body",
          value: `term-${index}`,
        })),
      })
    ).toEqual({
      kind: "invalid",
      error: "Request search accepts at most 8 field filters.",
    })
  })

  it("matches every condition across the selected fields", () => {
    const parsed = parseRequestSearchCriteria({
      methods: ["post"],
      conditions: [
        { field: "path", value: "/payments" },
        { field: "url", value: "source=stripe" },
        { field: "body", value: "payment.created" },
      ],
    })

    expect(parsed.kind).toBe("valid")

    if (parsed.kind !== "valid") {
      return
    }

    expect(requestSearchIsActive(parsed.value)).toBe(true)
    expect(requestMatchesSearch(createRequest(), parsed.value)).toBe(true)
    expect(
      requestMatchesSearch(createRequest({ method: "GET" }), parsed.value)
    ).toBe(false)
    expect(
      requestMatchesSearch(
        createRequest({ path: "/orders", url: "/orders" }),
        parsed.value
      )
    ).toBe(false)
  })

  it("matches structured JSON fields by key or value", () => {
    const parsed = parseRequestSearchCriteria({
      conditions: [
        { field: "headers", value: "x-request-id" },
        { field: "query", value: "stripe" },
      ],
    })

    expect(parsed.kind).toBe("valid")

    if (parsed.kind !== "valid") {
      return
    }

    expect(requestMatchesSearch(createRequest(), parsed.value)).toBe(true)
  })

  it("serializes criteria as direct field query parameters", () => {
    const parsed = parseRequestSearchCriteria({
      methods: ["POST", "GET"],
      conditions: [
        { field: "path", value: "/payments" },
        { field: "query", value: "source" },
      ],
    })

    expect(parsed.kind).toBe("valid")

    if (parsed.kind !== "valid") {
      return
    }

    expect(serializeRequestSearchCriteria(parsed.value).toString()).toBe(
      "method=POST&method=GET&path=%2Fpayments&query=source"
    )
    expect(requestSearchIsActive(EMPTY_REQUEST_SEARCH)).toBe(false)
  })

  it("parses advanced field queries with boolean operators", () => {
    const parsed = parseAdvancedRequestSearchQuery(
      'method:POST AND (body:"payment.created" OR query.source:stripe) AND NOT ip:198.51.100.9'
    )

    expect(parsed.kind).toBe("valid")

    if (parsed.kind !== "valid") {
      return
    }

    expect(parsed.value.mode).toBe("advanced")
    expect(requestMatchesSearch(createRequest(), parsed.value)).toBe(true)
    expect(
      requestMatchesSearch(createRequest({ method: "GET" }), parsed.value)
    ).toBe(false)
    expect(
      requestMatchesSearch(createRequest({ ip: "198.51.100.9" }), parsed.value)
    ).toBe(false)
  })

  it("parses advanced header and query key searches", () => {
    const parsed = parseAdvancedRequestSearchQuery(
      "headers.x-request-id:req_123 query.source:stripe"
    )

    expect(parsed.kind).toBe("valid")

    if (parsed.kind !== "valid") {
      return
    }

    expect(requestMatchesSearch(createRequest(), parsed.value)).toBe(true)
    expect(
      requestMatchesSearch(
        createRequest({ headers: { "x-request-id": "other" } }),
        parsed.value
      )
    ).toBe(false)
  })

  it("parses advanced aggregate and key-value header/query searches", () => {
    const parsed = parseAdvancedRequestSearchQuery(
      "headerName:x-request headerValue:req_123 queryName:source queryValue:stripe headers:content-type query:source"
    )

    expect(parsed.kind).toBe("valid")

    if (parsed.kind !== "valid") {
      return
    }

    expect(requestMatchesSearch(createRequest(), parsed.value)).toBe(true)
    expect(
      requestMatchesSearch(
        createRequest({
          query: { other: ["stripe"] },
          headers: { other: "req_123" },
        }),
        parsed.value
      )
    ).toBe(false)
  })

  it("rejects invalid advanced search syntax", () => {
    expect(parseAdvancedRequestSearchQuery("headers.:value")).toEqual({
      kind: "invalid",
      error: 'Advanced request search field "headers." is not supported.',
    })
    expect(parseAdvancedRequestSearchQuery("method:")).toEqual({
      kind: "invalid",
      error: 'Advanced request search field "method" is missing a value.',
    })
    expect(parseAdvancedRequestSearchQuery("(method:POST")).toEqual({
      kind: "invalid",
      error: "Advanced request search has an unmatched parenthesis.",
    })
    expect(parseAdvancedRequestSearchQuery("unknown:value")).toEqual({
      kind: "invalid",
      error: 'Advanced request search field "unknown" is not supported.',
    })
  })

  it("serializes advanced search as a single search query parameter", () => {
    const parsed = parseAdvancedRequestSearchQuery(
      "method:POST AND headers.content-type:json"
    )

    expect(parsed.kind).toBe("valid")

    if (parsed.kind !== "valid") {
      return
    }

    expect(serializeRequestSearchCriteria(parsed.value).toString()).toBe(
      "search=method%3APOST+AND+headers.content-type%3Ajson"
    )
  })
})
