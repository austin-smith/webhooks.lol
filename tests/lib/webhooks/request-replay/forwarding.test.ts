import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"

import { eq, inArray } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

for (const envFile of [".env", ".env.local"]) {
  if (existsSync(envFile)) {
    loadEnvFile(envFile)
  }
}

const {
  assertEndpointForwardTargetUrlCanBeReachedSafely,
  checkWebhookCaptureBodyAdmission,
  enqueueEndpointForwardDeliveryJob,
  publishRequest,
} = vi.hoisted(() => ({
  assertEndpointForwardTargetUrlCanBeReachedSafely: vi.fn(),
  checkWebhookCaptureBodyAdmission: vi.fn(),
  enqueueEndpointForwardDeliveryJob: vi.fn(),
  publishRequest: vi.fn(),
}))

vi.mock("@/lib/webhooks/admission-control", () => ({
  checkWebhookCaptureBodyAdmission,
}))

vi.mock("@/lib/webhooks/endpoint-event-stream", () => ({
  publishRequest,
}))

vi.mock(
  "@/lib/webhooks/endpoint-forwarding/policy",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/lib/webhooks/endpoint-forwarding/policy")
    >()),
    assertEndpointForwardTargetUrlCanBeReachedSafely,
  })
)

vi.mock("@/lib/webhooks/endpoint-forwarding/queue", () => ({
  enqueueEndpointForwardDeliveryJob,
}))

import { getDatabase } from "@/lib/database/client"
import { endpointForwardDeliveries, endpoints } from "@/lib/database/schema"
import { createEndpointForwardTarget } from "@/lib/webhooks/endpoint-forwarding/repository"
import { createEndpoint, saveCapturedRequest } from "@/lib/webhooks/repository"
import { replayCapturedRequest } from "@/lib/webhooks/request-replay/replay-request"

const createdEndpointIds: string[] = []

describe("request replay forwarding", () => {
  beforeEach(() => {
    assertEndpointForwardTargetUrlCanBeReachedSafely.mockReset()
    assertEndpointForwardTargetUrlCanBeReachedSafely.mockResolvedValue(
      undefined
    )
    checkWebhookCaptureBodyAdmission.mockReset()
    checkWebhookCaptureBodyAdmission.mockResolvedValue(createAllowedAdmission())
    enqueueEndpointForwardDeliveryJob.mockReset()
    publishRequest.mockReset()
  })

  afterEach(async () => {
    if (createdEndpointIds.length === 0) {
      return
    }

    await getDatabase()
      .delete(endpoints)
      .where(inArray(endpoints.id, [...createdEndpointIds]))
    createdEndpointIds.length = 0
  })

  it("queues forwarding deliveries for the replayed request", async () => {
    const endpoint = await createEndpoint()
    createdEndpointIds.push(endpoint.endpointId)
    const target = await createEndpointForwardTarget({
      endpointId: endpoint.endpointId,
      url: "https://example.com/webhook",
    })
    const sourceRequest = await saveCapturedRequest({
      endpointId: endpoint.endpointId,
      method: "POST",
      url: "/events",
      path: "/events",
      query: {},
      headers: { "content-type": "application/json" },
      bodyBase64: "e30=",
      bodySize: 2,
      bodyText: "{}",
      contentType: "application/json",
      ip: null,
    })
    enqueueEndpointForwardDeliveryJob.mockReset()

    const result = await replayCapturedRequest({
      endpointId: endpoint.endpointId,
      request: createReplayHttpRequest({
        endpointId: endpoint.endpointId,
        requestId: sourceRequest.id,
      }),
      requestId: sourceRequest.id,
    })

    expect(result.request.id).not.toBe(sourceRequest.id)
    expect(publishRequest).toHaveBeenCalledWith(result.request)

    const deliveries = await getDatabase()
      .select()
      .from(endpointForwardDeliveries)
      .where(eq(endpointForwardDeliveries.requestId, result.request.id))

    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]).toMatchObject({
      endpointId: endpoint.endpointId,
      requestId: result.request.id,
      status: "pending",
      targetId: target.id,
    })
    expect(enqueueEndpointForwardDeliveryJob).toHaveBeenCalledWith({
      deliveryId: deliveries[0]?.id,
      targetId: target.id,
      transaction: expect.anything(),
    })
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

function createReplayHttpRequest({
  endpointId,
  requestId,
}: {
  endpointId: string
  requestId: string
}) {
  return new Request(
    `https://hooks.example.com/api/endpoints/${endpointId}/requests/${requestId}/replay`,
    {
      method: "POST",
    }
  )
}
