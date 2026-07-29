import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  acquireEndpointEventStreamAdmission,
  assertEndpointAccessibleToActor,
  openEndpointEventStream,
} = vi.hoisted(() => ({
  acquireEndpointEventStreamAdmission: vi.fn(),
  assertEndpointAccessibleToActor: vi.fn(),
  openEndpointEventStream: vi.fn(),
}))

vi.mock("@webhooks-lol/webhooks-server/admission-control", () => ({
  acquireEndpointEventStreamAdmission,
}))

vi.mock("@webhooks-lol/webhooks-server/endpoint-event-stream", () => ({
  openEndpointEventStream,
}))

vi.mock("@webhooks-lol/webhooks-server/repository", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@webhooks-lol/webhooks-server/repository")
  >()),
  assertEndpointAccessibleToActor,
}))

import { GET } from "@/app/api/endpoints/[endpointId]/events/route"
import { MissingClientIdentityHeaderError } from "@webhooks-lol/webhooks-server/rate-limits/client-identity"
import { RateLimitStoreUnavailableError } from "@webhooks-lol/webhooks-server/rate-limits/store"
import { EndpointNotFoundError } from "@webhooks-lol/webhooks-server/repository"

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"

function createContext(endpointId = ENDPOINT_ID) {
  return {
    params: Promise.resolve({ endpointId }),
  } as RouteContext<"/api/endpoints/[endpointId]/events">
}

function createAllowedAdmission() {
  return {
    kind: "allowed" as const,
    clientIdentity: {
      key: "client:test",
      keyHash: null,
      source: "global" as const,
    },
    lease: {
      release: vi.fn(),
      renew: vi.fn(),
    },
  }
}

function createDeniedAdmission() {
  return {
    kind: "denied" as const,
    rateLimit: {
      limit: 1,
      policyId: "event-streams-endpoint",
      remaining: 0,
      resetSeconds: 60,
      retryAfterSeconds: 60,
      windowSeconds: 60,
    },
  }
}

describe("endpoint events route", () => {
  beforeEach(() => {
    acquireEndpointEventStreamAdmission.mockReset()
    acquireEndpointEventStreamAdmission.mockResolvedValue(
      createAllowedAdmission()
    )
    assertEndpointAccessibleToActor.mockReset()
    openEndpointEventStream.mockReset()
    openEndpointEventStream.mockReturnValue(new ReadableStream())
  })

  it("opens an event stream after acquiring a lease", async () => {
    const request = new Request(
      `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/events`
    )
    const response = await GET(request, createContext())

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/event-stream")
    expect(acquireEndpointEventStreamAdmission).toHaveBeenCalledWith({
      endpointId: ENDPOINT_ID,
      request,
    })
    expect(assertEndpointAccessibleToActor).toHaveBeenCalledWith(ENDPOINT_ID, {
      userId: null,
    })
    expect(openEndpointEventStream).toHaveBeenCalledWith({
      endpointId: ENDPOINT_ID,
      lease: expect.objectContaining({
        release: expect.any(Function),
        renew: expect.any(Function),
      }),
      signal: request.signal,
    })
  })

  it("rejects malformed endpoint IDs before querying", async () => {
    const response = await GET(
      new Request("https://hooks.example.com/api/endpoints/not-an-id/events"),
      createContext("not-an-id")
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Invalid endpoint ID.",
    })
    expect(assertEndpointAccessibleToActor).not.toHaveBeenCalled()
  })

  it("returns 429 when event stream leases are exhausted", async () => {
    acquireEndpointEventStreamAdmission.mockResolvedValueOnce(
      createDeniedAdmission()
    )

    const response = await GET(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/events`
      ),
      createContext()
    )

    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("60")
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Rate limit exceeded.",
      retryAfterSeconds: 60,
    })
    expect(assertEndpointAccessibleToActor).not.toHaveBeenCalled()
    expect(openEndpointEventStream).not.toHaveBeenCalled()
  })

  it("rejects event streams when the client identity header is missing", async () => {
    acquireEndpointEventStreamAdmission.mockRejectedValueOnce(
      new MissingClientIdentityHeaderError("x-forwarded-for")
    )

    const response = await GET(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/events`
      ),
      createContext()
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Required client identity header "x-forwarded-for" is missing.',
    })
    expect(assertEndpointAccessibleToActor).not.toHaveBeenCalled()
    expect(openEndpointEventStream).not.toHaveBeenCalled()
  })

  it("returns a retryable service response when lease admission is unavailable", async () => {
    acquireEndpointEventStreamAdmission.mockRejectedValueOnce(
      new RateLimitStoreUnavailableError()
    )

    const response = await GET(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/events`
      ),
      createContext()
    )

    expect(response.status).toBe(503)
    expect(response.headers.get("retry-after")).toBe("1")
    expect(assertEndpointAccessibleToActor).not.toHaveBeenCalled()
    expect(openEndpointEventStream).not.toHaveBeenCalled()
  })

  it("releases the acquired lease when the endpoint is unavailable", async () => {
    const admission = createAllowedAdmission()

    acquireEndpointEventStreamAdmission.mockResolvedValueOnce(admission)
    assertEndpointAccessibleToActor.mockRejectedValueOnce(
      new EndpointNotFoundError(ENDPOINT_ID)
    )

    const response = await GET(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/events`
      ),
      createContext()
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Endpoint not found.",
    })
    expect(acquireEndpointEventStreamAdmission).toHaveBeenCalled()
    expect(admission.lease.release).toHaveBeenCalledOnce()
    expect(openEndpointEventStream).not.toHaveBeenCalled()
  })
})
