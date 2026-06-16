import { describe, expect, it } from "vitest"

import {
  formatRequestAsCliCommand,
  formatRequestAsCurl,
  formatRequestAsFetch,
  formatWebhookRequestUrl,
} from "@/components/webhook-inspector/request-copy-formatters"
import {
  formatBytes,
  formatRelativeTime,
  formatRequestBodyDisplay,
  formatRequestListPath,
  getRequestBodyLanguage,
} from "@/components/webhook-inspector/request-formatters"
import type { CapturedRequest } from "@webhooks-lol/webhooks-core/types"

function createRequest(
  overrides: Partial<CapturedRequest> = {}
): CapturedRequest {
  return {
    id: "request-id",
    endpointId: "endpoint-id",
    method: "POST",
    url: "/api/hook/endpoint-id",
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

  it("suffixes past timestamps with 'ago'", () => {
    const now = Date.parse("2026-06-07T00:00:00.000Z")
    const value = new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString()

    expect(formatRelativeTime(value, now)).toBe("3 days ago")
  })

  it("prefixes future timestamps with 'in'", () => {
    const now = Date.parse("2026-06-07T00:00:00.000Z")
    const value = new Date(now + 1000 * 60 * 60 * 2).toISOString()

    expect(formatRelativeTime(value, now)).toBe("in 2 hours")
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
      name: "keeps the query string on root paths",
      request: createRequest({ query: { signature: ["abc"] } }),
      expected: "/?signature=abc",
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

  describe("copy formatters", () => {
    const webhookUrl = "https://example.test/api/hook/endpoint-id"

    it.each([
      {
        name: "root request",
        request: createRequest({
          url: "/",
          path: "/",
        }),
        expected: webhookUrl,
      },
      {
        name: "root query",
        request: createRequest({
          url: "/?signature=a%2Bb&signature=c",
          path: "/",
          query: { signature: ["a+b", "c"] },
        }),
        expected: `${webhookUrl}?signature=a%2Bb&signature=c`,
      },
      {
        name: "captured subpath and raw query",
        request: createRequest({
          url: "/stripe/events?signature=a%2Bb&signature=c",
          path: "/stripe/events",
          query: { signature: ["a+b", "c"] },
        }),
        expected: `${webhookUrl}/stripe/events?signature=a%2Bb&signature=c`,
      },
      {
        name: "legacy stored internal endpoint path",
        request: createRequest({
          url: "/api/hook/endpoint-id/stripe/events?signature=abc",
          path: "/stripe/events",
          query: { signature: ["abc"] },
        }),
        expected: `${webhookUrl}/stripe/events?signature=abc`,
      },
    ])("builds the copy URL for $name", ({ expected, request }) => {
      expect(
        formatWebhookRequestUrl({
          request,
          webhookUrl: `${webhookUrl}/`,
        })
      ).toBe(expected)
    })

    it("formats a text request as cURL", () => {
      const request = createRequest({
        url: "/stripe/events?signature=a%2Bb",
        path: "/stripe/events",
        headers: {
          "content-length": "27",
          "content-type": "application/json",
          host: "example.test",
          "stripe-signature": "t=1,v1=abc'def",
        },
        bodyText: '{"event":"payment.created"}',
        bodyBase64: "eyJldmVudCI6InBheW1lbnQuY3JlYXRlZCJ9",
        bodySize: 27,
      })

      expect(formatRequestAsCurl({ request, webhookUrl })).toBe(`curl \\
  --request 'POST' \\
  --url 'https://example.test/api/hook/endpoint-id/stripe/events?signature=a%2Bb' \\
  --header 'content-type: application/json' \\
  --header 'stripe-signature: t=1,v1=abc'\\''def' \\
  --data-binary '{"event":"payment.created"}'`)
    })

    it("omits request bodies from GET cURL commands", () => {
      const request = createRequest({
        method: "GET",
        url: "/events",
        path: "/events",
        headers: {
          "content-length": "27",
          "x-provider-signature": "abc",
        },
        bodyText: '{"ignored":true}',
        bodyBase64: "eyJpZ25vcmVkIjp0cnVlfQ==",
        bodySize: 16,
      })

      expect(formatRequestAsCurl({ request, webhookUrl })).toBe(`curl \\
  --request 'GET' \\
  --url 'https://example.test/api/hook/endpoint-id/events' \\
  --header 'x-provider-signature: abc'`)
    })

    it("formats a binary request as cURL without using display text", () => {
      const request = createRequest({
        url: "/upload",
        path: "/upload",
        headers: {
          "content-type": "application/octet-stream",
        },
        bodyText: "",
        bodyBase64: "AAE=",
        bodySize: 2,
      })

      expect(formatRequestAsCurl({ request, webhookUrl }))
        .toBe(`printf %s 'AAE=' | base64 --decode | \\
curl \\
  --request 'POST' \\
  --url 'https://example.test/api/hook/endpoint-id/upload' \\
  --header 'content-type: application/octet-stream' \\
  --data-binary @-`)
    })

    it("formats a text request as a fetch snippet", () => {
      const request = createRequest({
        url: "/stripe/events",
        path: "/stripe/events",
        headers: {
          "content-length": "27",
          "content-type": "application/json",
          "stripe-signature": "t=1,v1=abc",
        },
        bodyText: '{"event":"payment.created"}',
        bodyBase64: "eyJldmVudCI6InBheW1lbnQuY3JlYXRlZCJ9",
        bodySize: 27,
      })

      expect(formatRequestAsFetch({ request, webhookUrl }))
        .toBe(`await fetch("https://example.test/api/hook/endpoint-id/stripe/events", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "stripe-signature": "t=1,v1=abc",
  },
  body: "{\\"event\\":\\"payment.created\\"}"
})`)
    })

    it("formats a binary request as a fetch snippet", () => {
      const request = createRequest({
        url: "/upload",
        path: "/upload",
        headers: {
          "content-type": "application/octet-stream",
        },
        bodyText: "",
        bodyBase64: "AAE=",
        bodySize: 2,
      })

      expect(formatRequestAsFetch({ request, webhookUrl }))
        .toBe(`await fetch("https://example.test/api/hook/endpoint-id/upload", {
  method: "POST",
  headers: {
    "content-type": "application/octet-stream",
  },
  body: Uint8Array.from(atob("AAE="), (byte) => byte.charCodeAt(0))
})`)
    })

    it("formats a request as a CLI replay command", () => {
      const request = createRequest({
        id: "018f8b0d-5640-7448-b4ca-1a0e9f3f6f19",
        endpointId: "endpoint-with-'quote",
      })

      expect(formatRequestAsCliCommand({ request })).toBe(
        "npx whlol replay 'endpoint-with-'\\''quote' --request '018f8b0d-5640-7448-b4ca-1a0e9f3f6f19'"
      )
    })
  })
})
