import { describe, expect, it } from "vitest"

import {
  formatBytes,
  formatRequestBodyDisplay,
  formatRequestListPath,
  getRequestBodyLanguage,
} from "@/components/webhook-inspector/request-formatters"
import type { CapturedRequest } from "@/lib/webhooks/types"

function createRequest(
  overrides: Partial<CapturedRequest> = {}
): CapturedRequest {
  return {
    id: "request-id",
    token: "inbox-token",
    method: "POST",
    url: "/api/hook/inbox-token",
    path: "/",
    query: {},
    headers: {},
    bodyText: "",
    bodyBase64: "",
    bodySize: 0,
    contentType: null,
    receivedAt: "2026-06-05T00:00:00.000Z",
    ip: null,
    ...overrides,
  }
}

describe("request formatters", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1536, "1.5 KB"],
    [12_288, "12 KB"],
    [1_572_864, "1.5 MB"],
    [1_610_612_736, "1.5 GB"],
  ])("formats %i bytes as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })

  it.each([
    {
      name: "keeps root paths visible",
      request: createRequest(),
      expected: "/",
    },
    {
      name: "uses the captured path",
      request: createRequest({ path: "/stripe/events" }),
      expected: "/stripe/events",
    },
    {
      name: "marks root requests with query parameters",
      request: createRequest({ query: { signature: ["abc"] } }),
      expected: "/?query",
    },
  ])("$name", ({ expected, request }) => {
    expect(formatRequestListPath(request)).toBe(expected)
  })

  it.each([
    ["application/json", "json"],
    ["application/vnd.webhook+json; charset=utf-8", "json"],
    ["text/html", "html"],
    ["application/xhtml+xml", "xml"],
    ["application/xml", "xml"],
    ["application/soap+xml", "xml"],
    ["text/javascript", "javascript"],
    ["application/javascript", "javascript"],
    ["text/css", "css"],
    ["application/x-yaml", "yaml"],
    ["text/plain", "text"],
    [null, "text"],
  ] as const)("maps %s request bodies to %s", (contentType, language) => {
    expect(getRequestBodyLanguage(contentType)).toBe(language)
  })

  it.each([
    {
      name: "pretty prints valid JSON",
      request: createRequest({
        bodyText: '{"event":"payment.created","amount":42}',
        contentType: "application/json",
      }),
      expected: {
        language: "json",
        value: '{\n  "event": "payment.created",\n  "amount": 42\n}',
      },
    },
    {
      name: "keeps malformed JSON unchanged",
      request: createRequest({
        bodyText: '{"event":',
        contentType: "application/vnd.webhook+json",
      }),
      expected: {
        language: "json",
        value: '{"event":',
      },
    },
    {
      name: "keeps empty bodies plain",
      request: createRequest(),
      expected: {
        language: "text",
        value: "",
      },
    },
    {
      name: "keeps binary bodies plain",
      request: createRequest({
        bodyBase64: "AAE=",
        bodySize: 2,
        contentType: "application/octet-stream",
      }),
      expected: {
        language: "text",
        value: "Binary body\n\nBase64:\nAAE=",
      },
    },
  ])("$name", ({ expected, request }) => {
    expect(formatRequestBodyDisplay(request)).toEqual(expected)
  })
})
