import { beforeEach, describe, expect, it, vi } from "vitest"

const { createEndpoint, getEndpoint, updateEndpointName } = vi.hoisted(() => ({
  createEndpoint: vi.fn(),
  getEndpoint: vi.fn(),
  updateEndpointName: vi.fn(),
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

function createContext(endpointId = "endpoint-id") {
  return {
    params: Promise.resolve({ endpointId }),
  } as RouteContext<"/api/endpoints/[endpointId]">
}

describe("endpoint route", () => {
  beforeEach(() => {
    createEndpoint.mockReset()
    getEndpoint.mockReset()
    updateEndpointName.mockReset()
  })

  it("creates an endpoint with persisted metadata shape", async () => {
    createEndpoint.mockResolvedValueOnce({
      endpointId: "new-endpoint",
      name: null,
    })

    const response = await POST()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      endpointId: "new-endpoint",
      name: null,
    })
  })

  it("returns endpoint metadata", async () => {
    getEndpoint.mockResolvedValueOnce({
      endpointId: "endpoint-id",
      name: "Stripe",
    })

    const response = await GET(
      new Request("https://hooks.example.com/api/endpoints/endpoint-id"),
      createContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      endpointId: "endpoint-id",
      name: "Stripe",
    })
    expect(getEndpoint).toHaveBeenCalledWith("endpoint-id")
  })

  it("updates endpoint names", async () => {
    updateEndpointName.mockResolvedValueOnce({
      endpointId: "endpoint-id",
      name: "Payments",
    })

    const response = await PATCH(
      new Request("https://hooks.example.com/api/endpoints/endpoint-id", {
        body: JSON.stringify({ name: " Payments " }),
        method: "PATCH",
      }),
      createContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      endpointId: "endpoint-id",
      name: "Payments",
    })
    expect(updateEndpointName).toHaveBeenCalledWith({
      endpointId: "endpoint-id",
      name: "Payments",
    })
  })

  it("clears blank endpoint names", async () => {
    updateEndpointName.mockResolvedValueOnce({
      endpointId: "endpoint-id",
      name: null,
    })

    const response = await PATCH(
      new Request("https://hooks.example.com/api/endpoints/endpoint-id", {
        body: JSON.stringify({ name: " " }),
        method: "PATCH",
      }),
      createContext()
    )

    expect(response.status).toBe(200)
    expect(updateEndpointName).toHaveBeenCalledWith({
      endpointId: "endpoint-id",
      name: null,
    })
  })

  it("rejects invalid endpoint names", async () => {
    const response = await PATCH(
      new Request("https://hooks.example.com/api/endpoints/endpoint-id", {
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
      new Request("https://hooks.example.com/api/endpoints/endpoint-id", {
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
