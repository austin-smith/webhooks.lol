import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"

import { eq, inArray } from "drizzle-orm"
import { afterEach, describe, expect, it, vi } from "vitest"

for (const envFile of [".env", ".env.local"]) {
  if (existsSync(envFile)) {
    loadEnvFile(envFile)
  }
}

const {
  assertEndpointForwardTargetUrlCanBeReachedSafely,
  enqueueEndpointForwardDeliveryJob,
} = vi.hoisted(() => ({
  assertEndpointForwardTargetUrlCanBeReachedSafely: vi.fn(),
  enqueueEndpointForwardDeliveryJob: vi.fn(),
}))

vi.mock("@/lib/webhooks/endpoint-forwarding/policy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/webhooks/endpoint-forwarding/policy")>()),
  assertEndpointForwardTargetUrlCanBeReachedSafely,
}))

vi.mock("@/lib/webhooks/endpoint-forwarding/queue", () => ({
  enqueueEndpointForwardDeliveryJob,
}))

import { getDatabase } from "@/lib/database/client"
import {
  capturedRequests,
  endpointForwardDeliveries,
  endpointForwardTargets,
  endpoints,
} from "@/lib/database/schema"
import { EndpointForwardTargetValidationError } from "@/lib/webhooks/endpoint-forwarding/policy"
import {
  createEndpointForwardTarget,
  listEndpointForwardTargets,
  MAX_ENDPOINT_FORWARD_TARGETS,
  recordEndpointForwardDeliveryAttempt,
  updateEndpointForwardTarget,
} from "@/lib/webhooks/endpoint-forwarding/repository"
import {
  clearRequests,
  createEndpoint,
  getEndpointStats,
  listRequests,
  saveCapturedRequest,
} from "@/lib/webhooks/repository"
import { MAX_REQUESTS_PER_ENDPOINT } from "@/lib/webhooks/request-retention"

const createdEndpointIds: string[] = []

describe("endpoint forwarding repository", () => {
  afterEach(async () => {
    assertEndpointForwardTargetUrlCanBeReachedSafely.mockReset()
    enqueueEndpointForwardDeliveryJob.mockReset()

    if (createdEndpointIds.length === 0) {
      return
    }

    await getDatabase()
      .delete(endpoints)
      .where(inArray(endpoints.id, [...createdEndpointIds]))
    createdEndpointIds.length = 0
  })

  it("creates a delivery row and queue job when a captured request has an enabled target", async () => {
    assertEndpointForwardTargetUrlCanBeReachedSafely.mockResolvedValueOnce(
      undefined
    )
    const endpoint = await createEndpoint()
    createdEndpointIds.push(endpoint.endpointId)
    const target = await createEndpointForwardTarget({
      endpointId: endpoint.endpointId,
      url: "https://example.com/webhook",
    })

    const request = await saveCapturedRequest({
      endpointId: endpoint.endpointId,
      method: "POST",
      url: "/events",
      path: "/events",
      query: {},
      headers: {},
      bodyBase64: "e30=",
      bodySize: 2,
      bodyText: "{}",
      contentType: "application/json",
      ip: null,
    })

    const deliveries = await getDatabase()
      .select()
      .from(endpointForwardDeliveries)
      .where(eq(endpointForwardDeliveries.requestId, request.id))

    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]).toMatchObject({
      endpointId: endpoint.endpointId,
      requestId: request.id,
      status: "pending",
      targetId: target.id,
    })
    expect(enqueueEndpointForwardDeliveryJob).toHaveBeenCalledWith({
      deliveryId: deliveries[0]?.id,
      targetId: target.id,
      transaction: expect.anything(),
    })
  })

  it("lists and disables endpoint forward targets", async () => {
    assertEndpointForwardTargetUrlCanBeReachedSafely.mockResolvedValueOnce(
      undefined
    )
    const endpoint = await createEndpoint()
    createdEndpointIds.push(endpoint.endpointId)
    const target = await createEndpointForwardTarget({
      endpointId: endpoint.endpointId,
      pathMode: "preserve",
      url: "https://example.com/webhook",
    })

    await expect(
      listEndpointForwardTargets(endpoint.endpointId)
    ).resolves.toMatchObject([
      {
        enabled: true,
        id: target.id,
        pathMode: "preserve",
        url: "https://example.com/webhook",
      },
    ])

    await expect(
      updateEndpointForwardTarget({
        enabled: false,
        endpointId: endpoint.endpointId,
        targetId: target.id,
      })
    ).resolves.toMatchObject({
      enabled: false,
      id: target.id,
    })
  })

  it("caps forward targets per endpoint", async () => {
    assertEndpointForwardTargetUrlCanBeReachedSafely.mockResolvedValue(
      undefined
    )
    const endpoint = await createEndpoint()
    createdEndpointIds.push(endpoint.endpointId)
    let disabledTargetId: string | null = null

    for (let index = 0; index < MAX_ENDPOINT_FORWARD_TARGETS; index += 1) {
      const target = await createEndpointForwardTarget({
        endpointId: endpoint.endpointId,
        url: `https://example.com/webhook-${index}`,
      })

      if (index === 0) {
        disabledTargetId = target.id
      }
    }

    await expect(
      createEndpointForwardTarget({
        endpointId: endpoint.endpointId,
        url: "https://example.com/too-many",
      })
    ).rejects.toThrow(
      `Endpoints can have at most ${MAX_ENDPOINT_FORWARD_TARGETS} forward targets.`
    )

    if (!disabledTargetId) {
      throw new Error("Expected disabled target id.")
    }

    await updateEndpointForwardTarget({
      enabled: false,
      endpointId: endpoint.endpointId,
      targetId: disabledTargetId,
    })
    await expect(
      createEndpointForwardTarget({
        endpointId: endpoint.endpointId,
        url: "https://example.com/replacement",
      })
    ).resolves.toMatchObject({
      enabled: true,
      url: "https://example.com/replacement",
    })
    await expect(
      updateEndpointForwardTarget({
        enabled: true,
        endpointId: endpoint.endpointId,
        targetId: disabledTargetId,
      })
    ).rejects.toThrow(
      `Endpoints can have at most ${MAX_ENDPOINT_FORWARD_TARGETS} forward targets.`
    )
  })

  it("keeps pending forward delivery requests when clearing request history", async () => {
    assertEndpointForwardTargetUrlCanBeReachedSafely.mockResolvedValueOnce(
      undefined
    )
    const endpoint = await createEndpoint()
    createdEndpointIds.push(endpoint.endpointId)
    await createEndpointForwardTarget({
      endpointId: endpoint.endpointId,
      url: "https://example.com/webhook",
    })
    const request = await saveCapturedRequest({
      endpointId: endpoint.endpointId,
      method: "POST",
      url: "/events",
      path: "/events",
      query: {},
      headers: {},
      bodyBase64: "e30=",
      bodySize: 2,
      bodyText: "{}",
      contentType: "application/json",
      ip: null,
    })

    await clearRequests(endpoint.endpointId)

    await expect(listRequests(endpoint.endpointId)).resolves.toMatchObject({
      requests: [],
    })
    await expect(getEndpointStats(endpoint.endpointId)).resolves.toMatchObject({
      bodySizeBytes: 0,
      requestCount: 0,
    })

    const [retainedRequest] = await getDatabase()
      .select()
      .from(capturedRequests)
      .where(eq(capturedRequests.id, request.id))
    const deliveries = await getDatabase()
      .select()
      .from(endpointForwardDeliveries)
      .where(eq(endpointForwardDeliveries.requestId, request.id))

    expect(retainedRequest).toBeDefined()
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]).toMatchObject({
      requestId: request.id,
      status: "pending",
    })
    const deliveryId = deliveries[0]?.id

    if (!deliveryId) {
      throw new Error("Expected pending endpoint forward delivery.")
    }

    await recordEndpointForwardDeliveryAttempt({
      deliveryId,
      lastError: null,
      lastStatus: 204,
      status: "delivered",
    })

    const remainingRequests = await getDatabase()
      .select()
      .from(capturedRequests)
      .where(eq(capturedRequests.id, request.id))
    const remainingDeliveries = await getDatabase()
      .select()
      .from(endpointForwardDeliveries)
      .where(eq(endpointForwardDeliveries.requestId, request.id))

    expect(remainingRequests).toHaveLength(0)
    expect(remainingDeliveries).toHaveLength(0)
  })

  it("prunes over-retained requests after pending forwarding finishes", async () => {
    assertEndpointForwardTargetUrlCanBeReachedSafely.mockResolvedValueOnce(
      undefined
    )
    const endpoint = await createEndpoint()
    createdEndpointIds.push(endpoint.endpointId)
    const target = await createEndpointForwardTarget({
      endpointId: endpoint.endpointId,
      url: "https://example.com/webhook",
    })
    const requestRows = Array.from(
      { length: MAX_REQUESTS_PER_ENDPOINT + 1 },
      (_, index) => ({
        id: crypto.randomUUID(),
        bodyBase64: "",
        bodySize: 0,
        bodyText: "",
        contentType: null,
        deleteAfterForwarding: false,
        endpointId: endpoint.endpointId,
        headers: {},
        ip: null,
        method: "POST",
        path: `/events/${index}`,
        query: {},
        receivedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
        url: `/events/${index}`,
      })
    )
    const [oldestRequest] = requestRows

    if (!oldestRequest) {
      throw new Error("Expected generated request row.")
    }

    await getDatabase().insert(capturedRequests).values(requestRows)

    const deliveryId = crypto.randomUUID()
    await getDatabase().insert(endpointForwardDeliveries).values({
      id: deliveryId,
      endpointId: endpoint.endpointId,
      requestId: oldestRequest.id,
      status: "pending",
      targetId: target.id,
      targetPathMode: target.pathMode,
      targetUrl: target.url,
    })

    await recordEndpointForwardDeliveryAttempt({
      deliveryId,
      lastError: null,
      lastStatus: 204,
      status: "delivered",
    })

    const remainingRequests = await getDatabase()
      .select()
      .from(capturedRequests)
      .where(eq(capturedRequests.endpointId, endpoint.endpointId))
    const oldestRequestRows = await getDatabase()
      .select()
      .from(capturedRequests)
      .where(eq(capturedRequests.id, oldestRequest.id))

    expect(remainingRequests).toHaveLength(MAX_REQUESTS_PER_ENDPOINT)
    expect(oldestRequestRows).toHaveLength(0)
  })

  it("rejects unsafe targets before inserting them", async () => {
    assertEndpointForwardTargetUrlCanBeReachedSafely.mockRejectedValueOnce(
      new EndpointForwardTargetValidationError(
        "Forward URL must resolve to a public address."
      )
    )
    const endpoint = await createEndpoint()
    createdEndpointIds.push(endpoint.endpointId)

    await expect(
      createEndpointForwardTarget({
        endpointId: endpoint.endpointId,
        url: "https://127.0.0.1/webhook",
      })
    ).rejects.toThrow(EndpointForwardTargetValidationError)

    const targets = await getDatabase()
      .select()
      .from(endpointForwardTargets)
      .where(eq(endpointForwardTargets.endpointId, endpoint.endpointId))

    expect(targets).toHaveLength(0)
  })

  it("checks endpoint existence before resolving target hostnames", async () => {
    await expect(
      createEndpointForwardTarget({
        endpointId: crypto.randomUUID(),
        url: "https://does-not-exist.invalid/webhook",
      })
    ).rejects.toThrow("was not found")

    expect(
      assertEndpointForwardTargetUrlCanBeReachedSafely
    ).not.toHaveBeenCalled()
  })
})
