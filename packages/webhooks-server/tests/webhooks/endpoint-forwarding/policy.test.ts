import { describe, expect, it } from "vitest"

import {
  assertEndpointForwardTargetUrlCanBeReachedSafely,
  EndpointForwardTargetValidationError,
  normalizeEndpointForwardTargetUrl,
  parseEndpointForwardPathMode,
  resolveEndpointForwardTargetUrlSafely,
  type EndpointForwardTargetResolver,
} from "@webhooks-lol/webhooks-server/endpoint-forwarding/policy"

describe("endpoint forwarding target policy", () => {
  it("normalizes HTTPS target URLs", () => {
    expect(
      normalizeEndpointForwardTargetUrl("https://example.com/webhook#ignored")
    ).toBe("https://example.com/webhook")
  })

  it("rejects non-HTTPS targets", () => {
    expect(() =>
      normalizeEndpointForwardTargetUrl("http://example.com")
    ).toThrow(EndpointForwardTargetValidationError)
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
    await expect(
      assertEndpointForwardTargetUrlCanBeReachedSafely(
        "https://[::ffff:127.0.0.1]/webhook"
      )
    ).rejects.toThrow(EndpointForwardTargetValidationError)
  })

  it("allows public literal target addresses", async () => {
    await expect(
      resolveEndpointForwardTargetUrlSafely("https://178.63.67.153/webhook")
    ).resolves.toMatchObject({
      addresses: [{ address: "178.63.67.153", family: 4 }],
    })

    await expect(
      resolveEndpointForwardTargetUrlSafely(
        "https://[2606:4700:4700::1111]/webhook"
      )
    ).resolves.toMatchObject({
      addresses: [{ address: "2606:4700:4700::1111", family: 6 }],
    })
  })

  it("allows hostnames that resolve only to public addresses", async () => {
    const resolveHostname: EndpointForwardTargetResolver = async (hostname) => {
      expect(hostname).toBe("webhook.site")

      return [
        { address: "178.63.67.153", family: 4 },
        { address: "178.63.67.106", family: 4 },
      ]
    }

    await expect(
      resolveEndpointForwardTargetUrlSafely("https://webhook.site/webhook", {
        resolveHostname,
      })
    ).resolves.toMatchObject({
      addresses: [
        { address: "178.63.67.153", family: 4 },
        { address: "178.63.67.106", family: 4 },
      ],
    })
  })

  it("blocks hostnames when any resolved address is private", async () => {
    const resolveHostname: EndpointForwardTargetResolver = async () => [
      { address: "178.63.67.153", family: 4 },
      { address: "10.0.0.10", family: 4 },
    ]

    await expect(
      resolveEndpointForwardTargetUrlSafely("https://example.com/webhook", {
        resolveHostname,
      })
    ).rejects.toThrow("Forward URL must resolve to a public address.")
  })

  it("rejects hostnames that do not resolve", async () => {
    await expect(
      assertEndpointForwardTargetUrlCanBeReachedSafely(
        "https://does-not-exist.invalid/webhook"
      )
    ).rejects.toThrow("Forward URL hostname did not resolve.")
  })
})
