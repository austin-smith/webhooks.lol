import { afterEach, describe, expect, it, vi } from "vitest"

const { acquireConnectionLease } = vi.hoisted(() => ({
  acquireConnectionLease: vi.fn(),
}))

vi.mock("@webhooks-lol/webhooks-server/rate-limits/connection-leases", () => ({
  acquireConnectionLease,
}))

import { acquireEndpointEventStreamAdmission } from "@webhooks-lol/webhooks-server/admission-control"
import { RateLimitStoreUnavailableError } from "@webhooks-lol/webhooks-server/rate-limits/store"

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"

describe("endpoint event-stream admission", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("releases partial leases when a later acquisition fails", async () => {
    vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", "x-forwarded-for")
    const release = vi.fn().mockResolvedValue(undefined)

    acquireConnectionLease
      .mockReset()
      .mockResolvedValueOnce({
        kind: "acquired",
        id: "lease-1",
        limit: 3,
        policy: {
          id: "event-streams-endpoint",
          leaseSeconds: 60,
          limit: 3,
        },
        remaining: 2,
        release,
        renew: vi.fn(),
      })
      .mockRejectedValueOnce(new RateLimitStoreUnavailableError())

    await expect(
      acquireEndpointEventStreamAdmission({
        endpointId: ENDPOINT_ID,
        request: new Request(
          `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/events`,
          {
            headers: {
              "x-forwarded-for": "203.0.113.7",
            },
          }
        ),
      })
    ).rejects.toBeInstanceOf(RateLimitStoreUnavailableError)

    expect(release).toHaveBeenCalledOnce()
  })
})
