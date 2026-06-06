import { describe, expect, it } from "vitest"

import {
  InboxResponseValidationError,
  MAX_RESPONSE_BODY_BYTES,
  parseInboxResponseOverrideInput,
  renderInboxResponseBodyTemplate,
} from "@/lib/webhooks/inbox-response"

describe("inbox response overrides", () => {
  it("normalizes valid override input", () => {
    expect(
      parseInboxResponseOverrideInput({
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
      parseInboxResponseOverrideInput({
        status: 199,
        contentType: "",
        body: oversizedBody,
      })
    ).toThrow(InboxResponseValidationError)
  })

  it("rejects custom headers", () => {
    expect(() =>
      parseInboxResponseOverrideInput({
        status: 200,
        contentType: "text/plain",
        body: "",
        headers: {
          "X-Test": "custom",
        },
      })
    ).toThrow(/not supported/)
  })

  it("rejects content types that cannot be serialized by Fetch", () => {
    expect(() =>
      parseInboxResponseOverrideInput({
        status: 200,
        contentType: "text/plain\nx-test: injected",
        body: "",
      })
    ).toThrow(/invalid in headers/)
  })

  it("accepts override input without headers", () => {
    expect(
      parseInboxResponseOverrideInput({
        status: 204,
        contentType: "text/plain",
        body: "",
      })
    ).toEqual({
      status: 204,
      contentType: "text/plain",
      body: "",
    })
  })

  it("renders supported response body variables", () => {
    expect(
      renderInboxResponseBodyTemplate(
        "{{request.id}} {{inbox.token}} {{unknown.value}}",
        {
          inboxToken: "inbox-token",
          requestId: "captured-1",
        }
      )
    ).toBe("captured-1 inbox-token {{unknown.value}}")
  })
})
