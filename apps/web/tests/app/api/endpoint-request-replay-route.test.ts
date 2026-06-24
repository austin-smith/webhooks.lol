import { beforeEach, describe, expect, it, vi } from "vitest"

const { checkRequestReplayAdmission, replayCapturedRequest } = vi.hoisted(
  () => ({
    checkRequestReplayAdmission: vi.fn(),
    replayCapturedRequest: vi.fn(),
  })
)
const { assertEndpointAccessibleToActor, isEndpointUnavailableError } =
  vi.hoisted(() => ({
    assertEndpointAccessibleToActor: vi.fn(),
    isEndpointUnavailableError: vi.fn(() => false),
  }))

vi.mock("@webhooks-lol/webhooks-server/admission-control", () => ({
  checkRequestReplayAdmission,
}))

vi.mock("@webhooks-lol/webhooks-server/request-replay/replay-request", () => ({
  isReplayBodyRateLimitedError: vi.fn(() => false),
  isReplayEndpointUnavailableError: vi.fn(() => false),
  isReplayRequestUnavailableError: vi.fn(() => false),
  replayCapturedRequest,
}))

vi.mock("@webhooks-lol/webhooks-server/repository", () => ({
  assertEndpointAccessibleToActor,
  isEndpointUnavailableError,
}))

import { POST } from "@/app/api/endpoints/[endpointId]/requests/[requestId]/replay/route"
import { MissingClientIdentityHeaderError } from "@webhooks-lol/webhooks-server/rate-limits/client-identity"

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"
const REQUEST_ID = "22222222-2222-4222-8222-222222222222"
const LETTERED_REQUEST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

function createContext({
  endpointId = ENDPOINT_ID,
  requestId = REQUEST_ID,
}: {
  endpointId?: string
  requestId?: string
} = {}) {
  return {
    params: Promise.resolve({ endpointId, requestId }),
  } as RouteContext<"/api/endpoints/[endpointId]/requests/[requestId]/replay">
}

describe("endpoint request replay route", () => {
  beforeEach(() => {
    checkRequestReplayAdmission.mockReset()
    checkRequestReplayAdmission.mockResolvedValue(createAllowedAdmission())
    assertEndpointAccessibleToActor.mockReset()
    isEndpointUnavailableError.mockReset()
    isEndpointUnavailableError.mockReturnValue(false)
    replayCapturedRequest.mockReset()
  })

  it("replays a captured request without requiring a target body", async () => {
    const replayResult = createReplayResult()
    replayCapturedRequest.mockResolvedValueOnce(replayResult)

    const response = await POST(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/requests/${REQUEST_ID}/replay`,
        {
          method: "POST",
        }
      ),
      createContext()
    )

    expect(response.status).toBe(200)
    expect(checkRequestReplayAdmission).toHaveBeenCalledWith({
      endpointId: ENDPOINT_ID,
      request: expect.any(Request),
      requestId: REQUEST_ID,
    })
    expect(replayCapturedRequest).toHaveBeenCalledWith({
      endpointId: ENDPOINT_ID,
      request: expect.any(Request),
      requestId: REQUEST_ID,
    })
    await expect(response.json()).resolves.toEqual(replayResult)
  })

  it("rejects malformed route ids before calling replay", async () => {
    const response = await POST(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/requests/not-a-request/replay`,
        {
          method: "POST",
        }
      ),
      createContext({ requestId: "not-a-request" })
    )

    expect(response.status).toBe(400)
    expect(checkRequestReplayAdmission).not.toHaveBeenCalled()
    expect(replayCapturedRequest).not.toHaveBeenCalled()
  })

  it("normalizes request ids before admission and replay", async () => {
    const replayResult = createReplayResult()
    replayCapturedRequest.mockResolvedValueOnce(replayResult)

    const response = await POST(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/requests/${LETTERED_REQUEST_ID.toUpperCase()}/replay`,
        {
          method: "POST",
        }
      ),
      createContext({ requestId: LETTERED_REQUEST_ID.toUpperCase() })
    )

    expect(response.status).toBe(200)
    expect(checkRequestReplayAdmission).toHaveBeenCalledWith({
      endpointId: ENDPOINT_ID,
      request: expect.any(Request),
      requestId: LETTERED_REQUEST_ID,
    })
    expect(replayCapturedRequest).toHaveBeenCalledWith({
      endpointId: ENDPOINT_ID,
      request: expect.any(Request),
      requestId: LETTERED_REQUEST_ID,
    })
  })

  it("returns 429 without replaying when replay admission is exhausted", async () => {
    checkRequestReplayAdmission.mockResolvedValueOnce(createDeniedAdmission())

    const response = await POST(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/requests/${REQUEST_ID}/replay`,
        {
          method: "POST",
        }
      ),
      createContext()
    )

    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("60")
    expect(replayCapturedRequest).not.toHaveBeenCalled()
  })

  it("returns 400 without replaying when client identity is missing", async () => {
    checkRequestReplayAdmission.mockRejectedValueOnce(
      new MissingClientIdentityHeaderError("x-forwarded-for")
    )

    const response = await POST(
      new Request(
        `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/requests/${REQUEST_ID}/replay`,
        {
          method: "POST",
        }
      ),
      createContext()
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Required client identity header "x-forwarded-for" is missing.',
    })
    expect(replayCapturedRequest).not.toHaveBeenCalled()
  })
})

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
      policyId: "request-replay-client",
      remaining: 0,
      resetSeconds: 60,
      retryAfterSeconds: 60,
      windowSeconds: 60,
    },
  }
}

function createReplayResult() {
  return {
    endpointId: ENDPOINT_ID,
    originalRequestId: REQUEST_ID,
    request: {
      bodyBase64: "",
      bodySize: 0,
      bodyText: "",
      contentType: null,
      endpointId: ENDPOINT_ID,
      headers: {},
      id: "33333333-3333-4333-8333-333333333333",
      ip: null,
      method: "POST",
      path: "/hook",
      query: {},
      receivedAt: "2026-06-13T12:01:00.000Z",
      url: "/hook",
    },
  }
}
