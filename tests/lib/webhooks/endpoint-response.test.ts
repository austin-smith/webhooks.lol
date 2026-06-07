import { describe, expect, it } from "vitest"

import {
  EndpointResponseValidationError,
  MAX_RESPONSE_BODY_BYTES,
  parseEndpointResponseOverrideInput,
  renderEndpointResponseBodyTemplate,
} from "@/lib/webhooks/endpoint-response"

describe("endpoint response overrides", () => {
  it("normalizes valid override input", () => {
    expect(
      parseEndpointResponseOverrideInput({
        status: 201,
        contentType: " application/json ",
        body: '{"ok":true}',
      })
    ).toEqual({
      status: 201,
      contentType: "application/json",
      body: '{"ok":true}',
    })
  })

  it("rejects invalid status, content type, and body", () => {
    const oversizedBody = "x".repeat(MAX_RESPONSE_BODY_BYTES + 1)

    expect(() =>
      parseEndpointResponseOverrideInput({
        status: 199,
        contentType: "",
        body: oversizedBody,
      })
    ).toThrow(EndpointResponseValidationError)
  })

  it("rejects content types that cannot be serialized by Fetch", () => {
    expect(() =>
      parseEndpointResponseOverrideInput({
        status: 200,
        contentType: "text/plain\nx-test: injected",
        body: "",
      })
    ).toThrow(/invalid in headers/)
  })

  it("ignores fields outside the supported override shape", () => {
    expect(
      parseEndpointResponseOverrideInput({
        status: 204,
        contentType: "text/plain",
        body: "",
        headers: {
          "X-Test": "custom",
        },
      })
    ).toEqual({
      status: 204,
      contentType: "text/plain",
      body: "",
    })
  })

  it("renders supported response body variables", () => {
    expect(
      renderEndpointResponseBodyTemplate(
        "{{request.id}} {{endpoint.id}} {{unknown.value}}",
        {
          endpointId: "endpoint-id",
          requestId: "captured-1",
        }
      )
    ).toBe("captured-1 endpoint-id {{unknown.value}}")
  })
})
