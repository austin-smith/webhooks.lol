import { Buffer } from "node:buffer"

import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  checkWebhookCaptureBodyAdmission,
  getRequest,
  publishRequest,
  saveCapturedRequest,
} = vi.hoisted(() => ({
  checkWebhookCaptureBodyAdmission: vi.fn(),
  getRequest: vi.fn(),
  publishRequest: vi.fn(),
  saveCapturedRequest: vi.fn(),
}))

vi.mock("@webhooks-lol/webhooks-server/admission-control", () => ({
  checkWebhookCaptureBodyAdmission,
}))

vi.mock("@webhooks-lol/webhooks-server/endpoint-event-stream", () => ({
  publishRequest,
}))

vi.mock("@webhooks-lol/webhooks-server/repository", () => ({
  getRequest,
  isEndpointUnavailableError: vi.fn(() => false),
  saveCapturedRequest,
}))

import {
  replayCapturedRequest,
  ReplayRequestNotFoundError,
} from "@webhooks-lol/webhooks-server/request-replay/replay-request"

const ENDPOINT_ID = "11111111-1111-4111-8111-111111111111"
const REQUEST_ID = "22222222-2222-4222-8222-222222222222"
const REPLAYED_REQUEST_ID = "33333333-3333-4333-8333-333333333333"

describe("replayCapturedRequest", () => {
  beforeEach(() => {
    checkWebhookCaptureBodyAdmission.mockReset()
    checkWebhookCaptureBodyAdmission.mockResolvedValue(createAllowedAdmission())
    getRequest.mockReset()
    publishRequest.mockReset()
    saveCapturedRequest.mockReset()
  })

  it("saves a new captured request from the stored request", async () => {
    const request = createRequest()
    const replayedRequest = {
      ...request,
      id: REPLAYED_REQUEST_ID,
      receivedAt: "2026-06-13T12:01:00.000Z",
    }
    getRequest.mockResolvedValueOnce(request)
    saveCapturedRequest.mockResolvedValueOnce(replayedRequest)

    const result = await replayCapturedRequest({
      endpointId: ENDPOINT_ID,
      request: createReplayHttpRequest(),
      requestId: REQUEST_ID,
    })

    expect(checkWebhookCaptureBodyAdmission).toHaveBeenCalledWith({
      bodySize: request.bodySize,
      endpointId: ENDPOINT_ID,
      request: expect.any(Request),
    })
    expect(saveCapturedRequest).toHaveBeenCalledWith({
      bodyBase64: request.bodyBase64,
      bodySize: request.bodySize,
      bodyText: request.bodyText,
      contentType: request.contentType,
      endpointId: request.endpointId,
      headers: request.headers,
      ip: request.ip,
      method: request.method,
      path: request.path,
      query: request.query,
      url: request.url,
    })
    expect(publishRequest).toHaveBeenCalledWith(replayedRequest)
    const [saveCallOrder] = saveCapturedRequest.mock.invocationCallOrder
    const [publishCallOrder] = publishRequest.mock.invocationCallOrder

    if (saveCallOrder === undefined || publishCallOrder === undefined) {
      throw new Error("Expected save and publish calls to be recorded.")
    }

    expect(saveCallOrder).toBeLessThan(publishCallOrder)
    expect(result).toEqual({
      endpointId: ENDPOINT_ID,
      originalRequestId: REQUEST_ID,
      request: replayedRequest,
    })
  })

  it("rejects missing stored requests", async () => {
    getRequest.mockResolvedValueOnce(null)

    await expect(
      replayCapturedRequest({
        endpointId: ENDPOINT_ID,
        request: createReplayHttpRequest(),
        requestId: REQUEST_ID,
      })
    ).rejects.toThrow(ReplayRequestNotFoundError)
    expect(checkWebhookCaptureBodyAdmission).not.toHaveBeenCalled()
    expect(saveCapturedRequest).not.toHaveBeenCalled()
    expect(publishRequest).not.toHaveBeenCalled()
  })

  it("does not save or publish when replay body bytes are rate limited", async () => {
    getRequest.mockResolvedValueOnce(createRequest())
    checkWebhookCaptureBodyAdmission.mockResolvedValueOnce({
      kind: "denied",
      rateLimit: createRateLimit(),
    })

    await expect(
      replayCapturedRequest({
        endpointId: ENDPOINT_ID,
        request: createReplayHttpRequest(),
        requestId: REQUEST_ID,
      })
    ).rejects.toMatchObject({
      name: "ReplayBodyRateLimitedError",
      rateLimit: createRateLimit(),
    })
    expect(saveCapturedRequest).not.toHaveBeenCalled()
    expect(publishRequest).not.toHaveBeenCalled()
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

function createRateLimit() {
  return {
    limit: 1024,
    policyId: "webhook-capture-bytes-endpoint",
    remaining: 0,
    resetSeconds: 60,
    retryAfterSeconds: 60,
    windowSeconds: 60,
  }
}

function createReplayHttpRequest() {
  return new Request(
    `https://hooks.example.com/api/endpoints/${ENDPOINT_ID}/requests/${REQUEST_ID}/replay`,
    {
      method: "POST",
    }
  )
}

function createRequest() {
  return {
    id: REQUEST_ID,
    endpointId: ENDPOINT_ID,
    method: "POST",
    url: "/events?source=test",
    path: "/events",
    query: { source: ["test"] },
    headers: { "content-type": "application/json" },
    bodyBase64: Buffer.from("{}").toString("base64"),
    bodySize: 2,
    bodyText: "{}",
    contentType: "application/json",
    ip: null,
    receivedAt: "2026-06-13T12:00:00.000Z",
  }
}
