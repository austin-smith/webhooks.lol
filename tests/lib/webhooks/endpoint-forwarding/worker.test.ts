import { Buffer } from "node:buffer"

import { beforeEach, describe, expect, it, vi } from "vitest"
import type { JobWithMetadata } from "pg-boss"

import {
  EndpointForwardTargetValidationError,
  type EndpointForwardDeliveryJob,
} from "@/lib/webhooks/endpoint-forwarding/policy"
import type { EndpointForwardDeliveryForProcessing } from "@/lib/webhooks/endpoint-forwarding/repository"
import type { CapturedRequest } from "@/lib/webhooks/types"

const {
  getEndpointForwardDeliveryForProcessing,
  recordEndpointForwardDeliveryAttempt,
  resolveEndpointForwardTargetUrlSafely,
} = vi.hoisted(() => ({
  getEndpointForwardDeliveryForProcessing: vi.fn(),
  recordEndpointForwardDeliveryAttempt: vi.fn(),
  resolveEndpointForwardTargetUrlSafely: vi.fn(),
}))

vi.mock(
  "@/lib/webhooks/endpoint-forwarding/policy",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/lib/webhooks/endpoint-forwarding/policy")
    >()),
    resolveEndpointForwardTargetUrlSafely,
  })
)

vi.mock("@/lib/webhooks/endpoint-forwarding/repository", async () => ({
  getEndpointForwardDeliveryForProcessing,
  recordEndpointForwardDeliveryAttempt,
}))

import { processEndpointForwardDeliveryJob } from "@/lib/webhooks/endpoint-forwarding/worker"

const DELIVERY_ID = "11111111-1111-4111-8111-111111111111"

function createRequest(): CapturedRequest {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    endpointId: "33333333-3333-4333-8333-333333333333",
    method: "POST",
    url: "/events",
    path: "/events",
    query: {},
    headers: { "content-type": "application/json" },
    bodyBase64: Buffer.from('{"ok":true}').toString("base64"),
    bodySize: 11,
    bodyText: '{"ok":true}',
    contentType: "application/json",
    ip: null,
    receivedAt: "2026-06-13T12:00:00.000Z",
  }
}

function createLoadedDelivery(
  overrides: Partial<EndpointForwardDeliveryForProcessing> = {}
): EndpointForwardDeliveryForProcessing {
  return {
    delivery: {
      id: DELIVERY_ID,
      attempts: 0,
      createdAt: "2026-06-13T12:00:00.000Z",
      deliveredAt: null,
      endpointId: "33333333-3333-4333-8333-333333333333",
      lastError: null,
      lastStatus: null,
      requestId: "22222222-2222-4222-8222-222222222222",
      status: "pending",
      targetId: "44444444-4444-4444-8444-444444444444",
      targetPathMode: "strip",
      targetUrl: "https://example.com/webhook",
      updatedAt: "2026-06-13T12:00:00.000Z",
    },
    request: createRequest(),
    target: {
      id: "44444444-4444-4444-8444-444444444444",
      createdAt: "2026-06-13T12:00:00.000Z",
      deleted: false,
      enabled: true,
      endpointId: "33333333-3333-4333-8333-333333333333",
      pathMode: "strip",
      updatedAt: "2026-06-13T12:00:00.000Z",
      url: "https://example.com/webhook",
    },
    ...overrides,
  }
}

function createJob(
  overrides: Partial<JobWithMetadata<EndpointForwardDeliveryJob>> = {}
) {
  return {
    id: DELIVERY_ID,
    createdOn: new Date(),
    completedOn: null,
    data: { deliveryId: DELIVERY_ID },
    deadLetter: "",
    deleteAfterSeconds: 0,
    expireInSeconds: 60,
    groupId: null,
    heartbeatOn: null,
    heartbeatSeconds: null,
    keepUntil: new Date(),
    name: "endpoint-forward-delivery",
    output: {},
    policy: "standard",
    priority: 0,
    retryBackoff: true,
    retryCount: 0,
    retryDelay: 30,
    retryDelayMax: 3600,
    retryLimit: 8,
    signal: new AbortController().signal,
    singletonKey: null,
    singletonOn: null,
    startAfter: new Date(),
    startedOn: new Date(),
    state: "active",
    ...overrides,
  } satisfies JobWithMetadata<EndpointForwardDeliveryJob>
}

describe("processEndpointForwardDeliveryJob", () => {
  beforeEach(() => {
    getEndpointForwardDeliveryForProcessing.mockReset()
    recordEndpointForwardDeliveryAttempt.mockReset()
    resolveEndpointForwardTargetUrlSafely.mockReset()
    resolveEndpointForwardTargetUrlSafely.mockResolvedValue({
      addresses: [{ address: "93.184.216.34", family: 4 }],
      url: new URL("https://example.com/webhook"),
    })
  })

  it("marks a 2xx response delivered", async () => {
    getEndpointForwardDeliveryForProcessing.mockResolvedValueOnce(
      createLoadedDelivery()
    )
    const transport = vi.fn(async () => ({ status: 204 }))

    await processEndpointForwardDeliveryJob({
      job: createJob(),
      transport,
    })

    expect(transport).toHaveBeenCalledOnce()
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        addresses: [{ address: "93.184.216.34", family: 4 }],
        method: "POST",
        url: new URL("https://example.com/webhook"),
      })
    )
    expect(recordEndpointForwardDeliveryAttempt).toHaveBeenCalledWith({
      deliveryId: DELIVERY_ID,
      lastError: null,
      lastStatus: 204,
      status: "delivered",
    })
  })

  it("throws for retryable responses before the final attempt", async () => {
    getEndpointForwardDeliveryForProcessing.mockResolvedValueOnce(
      createLoadedDelivery()
    )
    const transport = vi.fn(async () => ({ status: 500 }))

    await expect(
      processEndpointForwardDeliveryJob({
        job: createJob(),
        transport,
      })
    ).rejects.toThrow("HTTP 500")
    expect(recordEndpointForwardDeliveryAttempt).toHaveBeenCalledWith({
      deliveryId: DELIVERY_ID,
      lastError: "Forward target responded with HTTP 500.",
      lastStatus: 500,
      status: "pending",
    })
  })

  it("marks retryable responses failed on the final attempt", async () => {
    getEndpointForwardDeliveryForProcessing.mockResolvedValueOnce(
      createLoadedDelivery()
    )
    const transport = vi.fn(async () => ({ status: 500 }))

    await processEndpointForwardDeliveryJob({
      job: createJob({ retryCount: 8, retryLimit: 8 }),
      transport,
    })

    expect(recordEndpointForwardDeliveryAttempt).toHaveBeenCalledWith({
      deliveryId: DELIVERY_ID,
      lastError: "Forward target responded with HTTP 500.",
      lastStatus: 500,
      status: "failed",
    })
  })

  it("marks unsafe targets failed without calling fetch", async () => {
    getEndpointForwardDeliveryForProcessing.mockResolvedValueOnce(
      createLoadedDelivery()
    )
    resolveEndpointForwardTargetUrlSafely.mockRejectedValueOnce(
      new EndpointForwardTargetValidationError(
        "Forward URL must resolve to a public address."
      )
    )
    const transport = vi.fn()

    await processEndpointForwardDeliveryJob({
      job: createJob(),
      transport,
    })

    expect(transport).not.toHaveBeenCalled()
    expect(recordEndpointForwardDeliveryAttempt).toHaveBeenCalledWith({
      deliveryId: DELIVERY_ID,
      lastError: "Forward URL must resolve to a public address.",
      lastStatus: null,
      status: "failed",
    })
  })

  it("retries transient DNS validation failures", async () => {
    getEndpointForwardDeliveryForProcessing.mockResolvedValueOnce(
      createLoadedDelivery()
    )
    resolveEndpointForwardTargetUrlSafely.mockRejectedValueOnce(
      new EndpointForwardTargetValidationError(
        "Forward URL hostname did not resolve.",
        { retryable: true }
      )
    )
    const transport = vi.fn()

    await expect(
      processEndpointForwardDeliveryJob({
        job: createJob(),
        transport,
      })
    ).rejects.toThrow("Forward URL hostname did not resolve.")

    expect(transport).not.toHaveBeenCalled()
    expect(recordEndpointForwardDeliveryAttempt).toHaveBeenCalledWith({
      deliveryId: DELIVERY_ID,
      lastError: "Forward URL hostname did not resolve.",
      lastStatus: null,
      status: "pending",
    })
  })

  it("marks disabled targets failed without calling transport", async () => {
    getEndpointForwardDeliveryForProcessing.mockResolvedValueOnce(
      createLoadedDelivery({
        target: {
          ...createLoadedDelivery().target,
          enabled: false,
        },
      })
    )
    const transport = vi.fn()

    await processEndpointForwardDeliveryJob({
      job: createJob(),
      transport,
    })

    expect(transport).not.toHaveBeenCalled()
    expect(recordEndpointForwardDeliveryAttempt).toHaveBeenCalledWith({
      deliveryId: DELIVERY_ID,
      lastError: "Forward target is disabled.",
      lastStatus: null,
      status: "failed",
    })
  })

  it("marks deleted targets cancelled without calling transport", async () => {
    getEndpointForwardDeliveryForProcessing.mockResolvedValueOnce(
      createLoadedDelivery({
        target: {
          ...createLoadedDelivery().target,
          deleted: true,
          enabled: false,
        },
      })
    )
    const transport = vi.fn()

    await processEndpointForwardDeliveryJob({
      job: createJob(),
      transport,
    })

    expect(transport).not.toHaveBeenCalled()
    expect(recordEndpointForwardDeliveryAttempt).toHaveBeenCalledWith({
      deliveryId: DELIVERY_ID,
      lastError: "Forward target was deleted.",
      lastStatus: null,
      status: "cancelled",
    })
  })

  it("ignores cancelled deliveries without calling transport", async () => {
    getEndpointForwardDeliveryForProcessing.mockResolvedValueOnce(
      createLoadedDelivery({
        delivery: {
          ...createLoadedDelivery().delivery,
          status: "cancelled",
        },
      })
    )
    const transport = vi.fn()

    await processEndpointForwardDeliveryJob({
      job: createJob(),
      transport,
    })

    expect(transport).not.toHaveBeenCalled()
    expect(recordEndpointForwardDeliveryAttempt).not.toHaveBeenCalled()
  })
})
