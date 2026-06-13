import { describe, expect, it } from "vitest"

import {
  assertEndpointForwardTargetUrlCanBeReachedSafely,
  EndpointForwardTargetValidationError,
  normalizeEndpointForwardTargetUrl,
  parseEndpointForwardPathMode,
} from "@/lib/webhooks/endpoint-forwarding/policy"

describe("endpoint forwarding target policy", () => {
  it("normalizes HTTPS target URLs", () => {
    expect(
      normalizeEndpointForwardTargetUrl("https://example.com/webhook#ignored")
    ).toBe("https://example.com/webhook")
  })

  it("rejects non-HTTPS targets", () => {
    expect(() => normalizeEndpointForwardTargetUrl("http://example.com")).toThrow(
      EndpointForwardTargetValidationError
    )
  })

  it("rejects target credentials", () => {
    expect(() =>
      normalizeEndpointForwardTargetUrl("https://user:pass@example.com")
    ).toThrow(EndpointForwardTargetValidationError)
  })

  it("parses path modes", () => {
    expect(parseEndpointForwardPathMode(undefined)).toBe("strip")
    expect(parseEndpointForwardPathMode("strip")).toBe("strip")
    expect(parseEndpointForwardPathMode("preserve")).toBe("preserve")
    expect(() => parseEndpointForwardPathMode("mirror")).toThrow(
      EndpointForwardTargetValidationError
    )
  })

  it("blocks private literal target addresses", async () => {
    await expect(
      assertEndpointForwardTargetUrlCanBeReachedSafely(
        "https://127.0.0.1/webhook"
      )
    ).rejects.toThrow(EndpointForwardTargetValidationError)
    await expect(
      assertEndpointForwardTargetUrlCanBeReachedSafely("https://[::1]/webhook")
    ).rejects.toThrow(EndpointForwardTargetValidationError)
  })

  it("rejects hostnames that do not resolve", async () => {
    await expect(
      assertEndpointForwardTargetUrlCanBeReachedSafely(
        "https://does-not-exist.invalid/webhook"
      )
    ).rejects.toThrow("Forward URL hostname did not resolve.")
  })
})
