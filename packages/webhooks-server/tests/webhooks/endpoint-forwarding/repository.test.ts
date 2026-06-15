import { and, eq, inArray } from "drizzle-orm"
import { afterEach, describe, expect, it, vi } from "vitest"

const {
  assertEndpointForwardTargetUrlCanBeReachedSafely,
  enqueueEndpointForwardDeliveryJob,
} = vi.hoisted(() => ({
  assertEndpointForwardTargetUrlCanBeReachedSafely: vi.fn(),
  enqueueEndpointForwardDeliveryJob: vi.fn(),
}))

vi.mock(
  "@webhooks-lol/webhooks-server/endpoint-forwarding/policy",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@webhooks-lol/webhooks-server/endpoint-forwarding/policy")
    >()),
    assertEndpointForwardTargetUrlCanBeReachedSafely,
  })
)

vi.mock("@webhooks-lol/webhooks-server/endpoint-forwarding/queue", () => ({
  enqueueEndpointForwardDeliveryJob,
}))

import { getDatabase } from "@webhooks-lol/database/client"
import {
  capturedRequests,
  endpointForwardDeliveries,
  endpointForwardTargets,
  endpoints,
} from "@webhooks-lol/database/schema"
import { EndpointForwardTargetValidationError } from "@webhooks-lol/webhooks-server/endpoint-forwarding/policy"
import {
  createEndpointForwardTarget,
  deleteEndpointForwardTarget,
  listEndpointForwardTargets,
  MAX_ENDPOINT_FORWARD_TARGETS,
  recordEndpointForwardDeliveryAttempt,
  updateEndpointForwardTarget,
} from "@webhooks-lol/webhooks-server/endpoint-forwarding/repository"
import {
  clearRequests,
  createEndpoint,
  getEndpointStats,
  listRequests,
  saveCapturedRequest,
} from "@webhooks-lol/webhooks-server/repository"
import { MAX_REQUESTS_PER_ENDPOINT } from "@webhooks-lol/webhooks-server/request-retention"

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

  it("does not create forward deliveries for disabled forward targets", async () => {
    assertEndpointForwardTargetUrlCanBeReachedSafely.mockResolvedValueOnce(
      undefined
    )
    const endpoint = await createEndpoint()
    createdEndpointIds.push(endpoint.endpointId)
    const target = await createEndpointForwardTarget({
      endpointId: endpoint.endpointId,
      url: "https://example.com/webhook",
    })
    await updateEndpointForwardTarget({
      enabled: false,
      endpointId: endpoint.endpointId,
      targetId: target.id,
    })
    enqueueEndpointForwardDeliveryJob.mockReset()

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

    expect(deliveries).toHaveLength(0)
    expect(enqueueEndpointForwardDeliveryJob).not.toHaveBeenCalled()
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
    await expect(
      listEndpointForwardTargets(endpoint.endpointId)
    ).resolves.toMatchObject([
      {
        enabled: false,
        id: target.id,
      },
    ])
  })

  it("soft deletes endpoint forward targets and cancels pending deliveries", async () => {
    assertEndpointForwardTargetUrlCanBeReachedSafely.mockResolvedValue(
      undefined
    )
    const endpoint = await createEndpoint()
    createdEndpointIds.push(endpoint.endpointId)
    const target = await createEndpointForwardTarget({
      endpointId: endpoint.endpointId,
      pathMode: "preserve",
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

    await deleteEndpointForwardTarget({
      endpointId: endpoint.endpointId,
      targetId: target.id,
    })

    await expect(
      listEndpointForwardTargets(endpoint.endpointId)
    ).resolves.toEqual([])

    const [deletedTarget] = await getDatabase()
      .select()
      .from(endpointForwardTargets)
      .where(eq(endpointForwardTargets.id, target.id))
    const [delivery] = await getDatabase()
      .select()
      .from(endpointForwardDeliveries)
      .where(eq(endpointForwardDeliveries.requestId, request.id))

    expect(deletedTarget).toMatchObject({
      deleted: true,
      enabled: false,
      id: target.id,
    })
    expect(delivery).toMatchObject({
      lastError: "Forward target was deleted.",
      requestId: request.id,
      status: "cancelled",
      targetId: target.id,
    })
    await expect(
      updateEndpointForwardTarget({
        enabled: true,
        endpointId: endpoint.endpointId,
        targetId: target.id,
      })
    ).rejects.toThrow("was not found")
    await expect(
      createEndpointForwardTarget({
        endpointId: endpoint.endpointId,
        pathMode: "preserve",
        url: "https://example.com/webhook",
      })
    ).resolves.toMatchObject({
      enabled: true,
      pathMode: "preserve",
      url: "https://example.com/webhook",
    })
  })

  it("excludes deleted endpoint forward targets from future forwarding", async () => {
    assertEndpointForwardTargetUrlCanBeReachedSafely.mockResolvedValue(
      undefined
    )
    const endpoint = await createEndpoint()
    createdEndpointIds.push(endpoint.endpointId)
    const target = await createEndpointForwardTarget({
      endpointId: endpoint.endpointId,
      url: "https://example.com/webhook",
    })

    await deleteEndpointForwardTarget({
      endpointId: endpoint.endpointId,
      targetId: target.id,
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

    expect(deliveries).toHaveLength(0)
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

  it("does not count forwarding-deletion rows against visible request retention", async () => {
    assertEndpointForwardTargetUrlCanBeReachedSafely.mockResolvedValueOnce(
      undefined
    )
    const endpoint = await createEndpoint()
    createdEndpointIds.push(endpoint.endpointId)
    const target = await createEndpointForwardTarget({
      endpointId: endpoint.endpointId,
      url: "https://example.com/webhook",
    })
    const visibleRequestRows = Array.from(
      { length: MAX_REQUESTS_PER_ENDPOINT - 1 },
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
        path: `/visible/${index}`,
        query: {},
        receivedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
        url: `/visible/${index}`,
      })
    )
    const forwardingOnlyRequestId = crypto.randomUUID()

    await getDatabase()
      .insert(capturedRequests)
      .values([
        ...visibleRequestRows,
        {
          id: forwardingOnlyRequestId,
          bodyBase64: "",
          bodySize: 0,
          bodyText: "",
          contentType: null,
          deleteAfterForwarding: true,
          endpointId: endpoint.endpointId,
          headers: {},
          ip: null,
          method: "POST",
          path: "/cleared-pending-forwarding",
          query: {},
          receivedAt: new Date(Date.UTC(2100, 0, 1)),
          url: "/cleared-pending-forwarding",
        },
      ])
    await getDatabase().insert(endpointForwardDeliveries).values({
      id: crypto.randomUUID(),
      endpointId: endpoint.endpointId,
      requestId: forwardingOnlyRequestId,
      status: "pending",
      targetId: target.id,
      targetPathMode: target.pathMode,
      targetUrl: target.url,
    })

    await saveCapturedRequest({
      endpointId: endpoint.endpointId,
      method: "POST",
      url: "/new-visible",
      path: "/new-visible",
      query: {},
      headers: {},
      bodyBase64: "",
      bodySize: 0,
      bodyText: "",
      contentType: null,
      ip: null,
    })

    const visibleRequests = await getDatabase()
      .select({ id: capturedRequests.id })
      .from(capturedRequests)
      .where(
        and(
          eq(capturedRequests.endpointId, endpoint.endpointId),
          eq(capturedRequests.deleteAfterForwarding, false)
        )
      )
    const forwardingOnlyRows = await getDatabase()
      .select({ id: capturedRequests.id })
      .from(capturedRequests)
      .where(eq(capturedRequests.id, forwardingOnlyRequestId))

    expect(visibleRequests).toHaveLength(MAX_REQUESTS_PER_ENDPOINT)
    expect(forwardingOnlyRows).toHaveLength(1)
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
