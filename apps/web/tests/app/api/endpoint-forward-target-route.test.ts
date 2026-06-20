import { beforeEach, describe, expect, it, vi } from "vitest"

const { deleteEndpointForwardTarget, updateEndpointForwardTarget } = vi.hoisted(
  () => ({
    deleteEndpointForwardTarget: vi.fn(),
    updateEndpointForwardTarget: vi.fn(),
  })
)
const { assertEndpointAccessibleToActor, isEndpointUnavailableError } =
  vi.hoisted(() => ({
    assertEndpointAccessibleToActor: vi.fn(),
    isEndpointUnavailableError: vi.fn(() => false),
  }))

vi.mock(
  "@webhooks-lol/webhooks-server/endpoint-forwarding/repository",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@webhooks-lol/webhooks-server/endpoint-forwarding/repository")
    >()),
    deleteEndpointForwardTarget,
    updateEndpointForwardTarget,
  })
)

vi.mock("@webhooks-lol/webhooks-server/repository", () => ({
  assertEndpointAccessibleToActor,
  isEndpointUnavailableError,
}))

import {
  DELETE,
  PATCH,
} from "@/app/api/endpoints/[endpointId]/forward-targets/[targetId]/route"

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"
const TARGET_ID = "22222222-2222-4222-8222-222222222222"

function createContext(
  endpointId = ENDPOINT_ID,
  targetId = TARGET_ID
): RouteContext<"/api/endpoints/[endpointId]/forward-targets/[targetId]"> {
  return {
    params: Promise.resolve({ endpointId, targetId }),
  } as RouteContext<"/api/endpoints/[endpointId]/forward-targets/[targetId]">
}

describe("endpoint forward target route", () => {
  beforeEach(() => {
    assertEndpointAccessibleToActor.mockReset()
    deleteEndpointForwardTarget.mockReset()
    isEndpointUnavailableError.mockReset()
    isEndpointUnavailableError.mockReturnValue(false)
    updateEndpointForwardTarget.mockReset()
  })

  it("updates forward targets through PATCH", async () => {
    updateEndpointForwardTarget.mockResolvedValueOnce({
      id: TARGET_ID,
      endpointId: ENDPOINT_ID,
      url: "https://example.com/webhook",
      pathMode: "strip",
      enabled: false,
      deleted: false,
      createdAt: "2026-06-13T12:00:00.000Z",
      updatedAt: "2026-06-13T12:01:00.000Z",
    })

    const response = await PATCH(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/forward-targets/${TARGET_ID}`,
        {
          body: JSON.stringify({ enabled: false }),
          method: "PATCH",
        }
      ),
      createContext()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      endpointId: ENDPOINT_ID,
      target: {
        enabled: false,
        id: TARGET_ID,
      },
    })
    expect(updateEndpointForwardTarget).toHaveBeenCalledWith({
      enabled: false,
      endpointId: ENDPOINT_ID,
      targetId: TARGET_ID,
    })
    expect(deleteEndpointForwardTarget).not.toHaveBeenCalled()
  })

  it("deletes forward targets through DELETE", async () => {
    deleteEndpointForwardTarget.mockResolvedValueOnce(undefined)

    const response = await DELETE(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/forward-targets/${TARGET_ID}`,
        {
          method: "DELETE",
        }
      ),
      createContext()
    )

    expect(response.status).toBe(204)
    await expect(response.text()).resolves.toBe("")
    expect(deleteEndpointForwardTarget).toHaveBeenCalledWith({
      endpointId: ENDPOINT_ID,
      targetId: TARGET_ID,
    })
    expect(updateEndpointForwardTarget).not.toHaveBeenCalled()
  })
})
