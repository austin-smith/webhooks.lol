import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_ENDPOINT_RESPONSE_CONFIG,
  MAX_RESPONSE_OVERRIDE_REQUEST_BYTES,
} from "@webhooks-lol/webhooks-core/endpoint-response"

const {
  assertEndpointAccessibleToActor,
  clearEndpointResponseOverride,
  getEndpointResponseConfig,
  setEndpointResponseOverride,
} = vi.hoisted(() => ({
  assertEndpointAccessibleToActor: vi.fn(),
  clearEndpointResponseOverride: vi.fn(),
  getEndpointResponseConfig: vi.fn(),
  setEndpointResponseOverride: vi.fn(),
}))

vi.mock("@webhooks-lol/webhooks-server/repository", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@webhooks-lol/webhooks-server/repository")
  >()),
  assertEndpointAccessibleToActor,
  clearEndpointResponseOverride,
  getEndpointResponseConfig,
  setEndpointResponseOverride,
}))

import {
  DELETE,
  GET,
  PUT,
} from "@/app/api/endpoints/[endpointId]/response/route"

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"

function createContext(endpointId = ENDPOINT_ID) {
  return {
    params: Promise.resolve({ endpointId }),
  } as RouteContext<"/api/endpoints/[endpointId]/response">
}

describe("endpoint response route", () => {
  beforeEach(() => {
    assertEndpointAccessibleToActor.mockReset()
    clearEndpointResponseOverride.mockReset()
    getEndpointResponseConfig.mockReset()
    setEndpointResponseOverride.mockReset()
  })

  it("returns the current response config", async () => {
    getEndpointResponseConfig.mockResolvedValueOnce(
      DEFAULT_ENDPOINT_RESPONSE_CONFIG
    )

    const response = await GET(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/response`
      ),
      createContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      endpointId: ENDPOINT_ID,
      response: DEFAULT_ENDPOINT_RESPONSE_CONFIG,
    })
    expect(getEndpointResponseConfig).toHaveBeenCalledWith(ENDPOINT_ID)
  })

  it("validates and stores a custom response override", async () => {
    const override = {
      status: 201,
      contentType: "application/json",
      body: '{"ok":true}',
    }
    setEndpointResponseOverride.mockResolvedValueOnce({
      mode: "custom",
      ...override,
    })

    const response = await PUT(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/response`,
        {
          method: "PUT",
          body: JSON.stringify(override),
        }
      ),
      createContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      endpointId: ENDPOINT_ID,
      response: {
        mode: "custom",
        ...override,
      },
    })
    expect(setEndpointResponseOverride).toHaveBeenCalledWith({
      endpointId: ENDPOINT_ID,
      override,
    })
  })

  it("rejects invalid override input", async () => {
    const response = await PUT(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/response`,
        {
          method: "PUT",
          body: JSON.stringify({
            status: 700,
            contentType: "text/plain",
            body: "",
          }),
        }
      ),
      createContext()
    )

    expect(response.status).toBe(400)
    expect(setEndpointResponseOverride).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("Status must be"),
      })
    )
  })

  it("rejects malformed JSON", async () => {
    const response = await PUT(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/response`,
        {
          method: "PUT",
          body: "{",
        }
      ),
      createContext()
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Request body must be valid JSON.",
    })
  })

  it("rejects oversized override requests before storing", async () => {
    const response = await PUT(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/response`,
        {
          method: "PUT",
          body: "x".repeat(MAX_RESPONSE_OVERRIDE_REQUEST_BYTES + 1),
        }
      ),
      createContext()
    )

    expect(response.status).toBe(413)
    expect(setEndpointResponseOverride).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Request body too large.",
      maxBodyBytes: MAX_RESPONSE_OVERRIDE_REQUEST_BYTES,
    })
  })

  it("clears a response override", async () => {
    clearEndpointResponseOverride.mockResolvedValueOnce(
      DEFAULT_ENDPOINT_RESPONSE_CONFIG
    )

    const response = await DELETE(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/response`,
        {
          method: "DELETE",
        }
      ),
      createContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      endpointId: ENDPOINT_ID,
      response: DEFAULT_ENDPOINT_RESPONSE_CONFIG,
    })
    expect(clearEndpointResponseOverride).toHaveBeenCalledWith(ENDPOINT_ID)
  })
})
