import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  checkEndpointCreateAdmission,
  createEndpoint,
  getEndpoint,
  updateEndpointName,
} = vi.hoisted(() => ({
  checkEndpointCreateAdmission: vi.fn(),
  createEndpoint: vi.fn(),
  getEndpoint: vi.fn(),
  updateEndpointName: vi.fn(),
}))

vi.mock("@/lib/webhooks/admission-control", () => ({
  checkEndpointCreateAdmission,
}))

vi.mock("@/lib/webhooks/repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/webhooks/repository")>()),
  createEndpoint,
  getEndpoint,
  updateEndpointName,
}))

import { POST } from "@/app/api/endpoints/route"
import {
  GET,
  MAX_ENDPOINT_METADATA_REQUEST_BYTES,
  PATCH,
} from "@/app/api/endpoints/[endpointId]/route"
import { MissingClientIdentityHeaderError } from "@/lib/rate-limits/client-identity"

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"
const NEW_ENDPOINT_ID = "22222222-2222-4222-8222-222222222222"

function createAllowedAdmission() {
  return {
    kind: "allowed" as const,
    clientIdentity: {
      key: "client:test",
      keyHash: "client-hash",
      source: "trusted-header" as const,
    },
  }
}

function createDeniedAdmission() {
  return {
    kind: "denied" as const,
    rateLimit: {
      limit: 1,
      policyId: "endpoint-create-client",
      remaining: 0,
      resetSeconds: 60,
      retryAfterSeconds: 60,
      windowSeconds: 60,
    },
  }
}

function createContext(endpointId = ENDPOINT_ID) {
  return {
    params: Promise.resolve({ endpointId }),
  } as RouteContext<"/api/endpoints/[endpointId]">
}

describe("endpoint route", () => {
  beforeEach(() => {
    checkEndpointCreateAdmission.mockReset()
    checkEndpointCreateAdmission.mockResolvedValue(createAllowedAdmission())
    createEndpoint.mockReset()
    getEndpoint.mockReset()
    updateEndpointName.mockReset()
  })

  it("creates an endpoint with persisted metadata shape", async () => {
    createEndpoint.mockResolvedValueOnce({
      endpointId: NEW_ENDPOINT_ID,
      name: null,
    })

    const response = await POST(
      new Request("https://hooks.example.com/api/endpoints", {
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      endpointId: NEW_ENDPOINT_ID,
      name: null,
    })
    expect(createEndpoint).toHaveBeenCalledWith({
      creatorKeyHash: "client-hash",
    })
  })

  it("rejects endpoint creation when the create policy is exhausted", async () => {
    checkEndpointCreateAdmission.mockResolvedValueOnce(createDeniedAdmission())

    const response = await POST(
      new Request("https://hooks.example.com/api/endpoints", {
        method: "POST",
      })
    )

    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("60")
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Rate limit exceeded.",
      retryAfterSeconds: 60,
    })
    expect(createEndpoint).not.toHaveBeenCalled()
  })

  it("rejects endpoint creation when the client identity header is missing", async () => {
    checkEndpointCreateAdmission.mockRejectedValueOnce(
      new MissingClientIdentityHeaderError("x-forwarded-for")
    )

    const response = await POST(
      new Request("https://hooks.example.com/api/endpoints", {
        method: "POST",
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Required client identity header "x-forwarded-for" is missing.',
    })
    expect(createEndpoint).not.toHaveBeenCalled()
  })

  it("returns endpoint metadata", async () => {
    getEndpoint.mockResolvedValueOnce({
      endpointId: ENDPOINT_ID,
      name: "Stripe",
    })

    const response = await GET(
      new Request(`https://hooks.example.com/api/endpoints/${ENDPOINT_ID}`),
      createContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      endpointId: ENDPOINT_ID,
      name: "Stripe",
    })
    expect(getEndpoint).toHaveBeenCalledWith(ENDPOINT_ID)
  })

  it("rejects malformed endpoint IDs before querying", async () => {
    const response = await GET(
      new Request("https://hooks.example.com/api/endpoints/not-an-id"),
      createContext("not-an-id")
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Invalid endpoint ID.",
    })
    expect(getEndpoint).not.toHaveBeenCalled()
  })

  it("updates endpoint names", async () => {
    updateEndpointName.mockResolvedValueOnce({
      endpointId: ENDPOINT_ID,
      name: "Payments",
    })

    const response = await PATCH(
      new Request(`https://hooks.example.com/api/endpoints/${ENDPOINT_ID}`, {
        body: JSON.stringify({ name: " Payments " }),
        method: "PATCH",
      }),
      createContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      endpointId: ENDPOINT_ID,
      name: "Payments",
    })
    expect(updateEndpointName).toHaveBeenCalledWith({
      endpointId: ENDPOINT_ID,
      name: "Payments",
    })
  })

  it("clears blank endpoint names", async () => {
    updateEndpointName.mockResolvedValueOnce({
      endpointId: ENDPOINT_ID,
      name: null,
    })

    const response = await PATCH(
      new Request(`https://hooks.example.com/api/endpoints/${ENDPOINT_ID}`, {
        body: JSON.stringify({ name: " " }),
        method: "PATCH",
      }),
      createContext()
    )

    expect(response.status).toBe(200)
    expect(updateEndpointName).toHaveBeenCalledWith({
      endpointId: ENDPOINT_ID,
      name: null,
    })
  })

  it("rejects invalid endpoint names", async () => {
    const response = await PATCH(
      new Request(`https://hooks.example.com/api/endpoints/${ENDPOINT_ID}`, {
        body: JSON.stringify({ name: "x".repeat(33) }),
        method: "PATCH",
      }),
      createContext()
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Endpoint name must be 32 characters or fewer.",
    })
    expect(updateEndpointName).not.toHaveBeenCalled()
  })

  it("rejects oversized metadata requests before storing", async () => {
    const response = await PATCH(
      new Request(`https://hooks.example.com/api/endpoints/${ENDPOINT_ID}`, {
        body: "x".repeat(MAX_ENDPOINT_METADATA_REQUEST_BYTES + 1),
        method: "PATCH",
      }),
      createContext()
    )

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Request body too large.",
      maxBodyBytes: MAX_ENDPOINT_METADATA_REQUEST_BYTES,
    })
    expect(updateEndpointName).not.toHaveBeenCalled()
  })
})
