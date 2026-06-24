import { eq, inArray } from "drizzle-orm"
import { afterEach, describe, expect, it } from "vitest"

import { getDatabase } from "@webhooks-lol/database/client"
import {
  account,
  capturedRequests,
  endpointForwardTargets,
  endpoints,
  user,
} from "@webhooks-lol/database/schema"
import { getAdminDashboardData } from "@webhooks-lol/webhooks-server/admin-reporting"
import {
  createEndpoint,
  saveCapturedRequest,
} from "@webhooks-lol/webhooks-server/repository"
import type { CapturedRequestInput } from "@webhooks-lol/webhooks-core/types"

const createdEndpointIds: string[] = []
const createdUserIds: string[] = []

describe("admin reporting", () => {
  afterEach(async () => {
    if (createdEndpointIds.length > 0) {
      await getDatabase()
        .delete(endpoints)
        .where(inArray(endpoints.id, [...createdEndpointIds]))
      createdEndpointIds.length = 0
    }

    if (createdUserIds.length > 0) {
      await getDatabase()
        .delete(user)
        .where(inArray(user.id, [...createdUserIds]))
      createdUserIds.length = 0
    }
  })

  it("attributes requests to user-owned and anonymous endpoints", async () => {
    const owner = await createTrackedUser("owner")
    await createTrackedAccount(owner.id, "credential")
    await createTrackedAccount(owner.id, "github")

    const ownedEndpoint = await createTrackedEndpoint({
      ownerUserId: owner.id,
    })
    const anonymousEndpoint = await createTrackedEndpoint({
      anonymousSessionId: `session-${crypto.randomUUID()}`,
    })

    const ownedRequest = await saveTrackedRequest({
      bodyText: "owned request",
      endpointId: ownedEndpoint.endpointId,
      method: "POST",
      path: "/owned",
      url: "/owned",
    })
    const anonymousRequest = await saveTrackedRequest({
      bodyText: "anonymous request",
      endpointId: anonymousEndpoint.endpointId,
      method: "PUT",
      path: "/anonymous",
      url: "/anonymous",
    })
    await getDatabase()
      .update(capturedRequests)
      .set({ deleteAfterForwarding: true })
      .where(eq(capturedRequests.id, anonymousRequest.id))
    await createForwardTargets(ownedEndpoint.endpointId)

    const dashboard = await getAdminDashboardData({
      endpoints: { pageSize: 100 },
      requests: { pageSize: 100 },
      users: { pageSize: 100 },
    })
    const ownedRecentRequest = dashboard.requests.rows.find(
      (request) => request.id === ownedRequest.id
    )
    const anonymousRecentRequest = dashboard.requests.rows.find(
      (request) => request.id === anonymousRequest.id
    )
    const ownerRow = dashboard.users.rows.find((row) => row.id === owner.id)
    const ownedEndpointRow = dashboard.endpoints.rows.find(
      (row) => row.endpointId === ownedEndpoint.endpointId
    )
    const anonymousEndpointRow = dashboard.endpoints.rows.find(
      (row) => row.endpointId === anonymousEndpoint.endpointId
    )

    expect(ownedRecentRequest).toMatchObject({
      endpointId: ownedEndpoint.endpointId,
      owner: {
        email: owner.email,
        id: owner.id,
        name: owner.name,
      },
      ownershipKind: "user-owned",
      path: "/owned",
    })
    expect(anonymousRecentRequest).toMatchObject({
      endpointId: anonymousEndpoint.endpointId,
      owner: null,
      ownershipKind: "anonymous",
      path: "/anonymous",
    })
    expect(ownerRow).toMatchObject({
      email: owner.email,
      endpointCount: 1,
      providerIds: ["credential", "github"],
      requestCount: 1,
    })
    expect(ownedEndpointRow).toMatchObject({
      endpointId: ownedEndpoint.endpointId,
      enabledForwardTargetCount: 2,
      owner: {
        email: owner.email,
        id: owner.id,
      },
      ownershipKind: "user-owned",
      requestCount: 1,
    })
    expect(anonymousEndpointRow).toMatchObject({
      endpointId: anonymousEndpoint.endpointId,
      ownershipKind: "anonymous",
      requestCount: 1,
    })
    expect(dashboard.overview.users).toBeGreaterThanOrEqual(1)
    expect(dashboard.overview.userOwnedEndpoints).toBeGreaterThanOrEqual(1)
    expect(dashboard.overview.anonymousEndpoints).toBeGreaterThanOrEqual(1)
    expect(dashboard.overview.payloadSizeBytes).toBeGreaterThanOrEqual(
      Buffer.byteLength("owned request") +
        Buffer.byteLength("anonymous request")
    )
  })

  it("paginates requests, users, and endpoints on the server", async () => {
    const unique = `admin-page-${crypto.randomUUID()}`
    const users = await Promise.all(
      Array.from({ length: 11 }, (_, index) =>
        createTrackedUser(`${unique}-${String(index).padStart(2, "0")}`)
      )
    )
    const createdEndpoints = await Promise.all(
      users.map((row) => createTrackedEndpoint({ ownerUserId: row.id }))
    )

    await Promise.all(
      createdEndpoints.map((endpoint, index) =>
        renameEndpoint(
          endpoint.endpointId,
          `${unique}-endpoint-${String(index).padStart(2, "0")}`
        )
      )
    )
    await Promise.all(
      createdEndpoints.map((endpoint, index) =>
        saveTrackedRequest({
          bodyText: `${unique} request ${index}`,
          endpointId: endpoint.endpointId,
          method: "POST",
          path: `/${unique}/request-${String(index).padStart(2, "0")}`,
          url: `/${unique}/request-${String(index).padStart(2, "0")}`,
        })
      )
    )

    const firstPage = await getAdminDashboardData({
      endpoints: {
        filters: {
          endpoint: unique,
        },
        page: 1,
        pageSize: 10,
        sort: "lastActivityAtTime",
        direction: "asc",
      },
      requests: {
        filters: {
          endpoint: unique,
          method: "POST",
        },
        page: 1,
        pageSize: 10,
        sort: "receivedAtTime",
        direction: "asc",
      },
      users: {
        filters: {
          user: unique,
        },
        page: 1,
        pageSize: 10,
        sort: "email",
        direction: "asc",
      },
    })
    const secondPage = await getAdminDashboardData({
      endpoints: {
        filters: {
          endpoint: unique,
        },
        page: 2,
        pageSize: 10,
        sort: "lastActivityAtTime",
        direction: "asc",
      },
      requests: {
        filters: {
          endpoint: unique,
          method: "POST",
        },
        page: 2,
        pageSize: 10,
        sort: "receivedAtTime",
        direction: "asc",
      },
      users: {
        filters: {
          user: unique,
        },
        page: 2,
        pageSize: 10,
        sort: "email",
        direction: "asc",
      },
    })

    expect(firstPage.requests).toMatchObject({
      page: 1,
      pageCount: 2,
      pageSize: 10,
      total: 11,
    })
    expect(firstPage.requests.rows).toHaveLength(10)
    expect(secondPage.requests).toMatchObject({
      page: 2,
      pageCount: 2,
      pageSize: 10,
      total: 11,
    })
    expect(secondPage.requests.rows).toHaveLength(1)

    expect(firstPage.users).toMatchObject({
      page: 1,
      pageCount: 2,
      pageSize: 10,
      total: 11,
    })
    expect(secondPage.users).toMatchObject({
      page: 2,
      pageCount: 2,
      pageSize: 10,
      total: 11,
    })
    expect(secondPage.users.rows).toHaveLength(1)

    expect(firstPage.endpoints).toMatchObject({
      page: 1,
      pageCount: 2,
      pageSize: 10,
      total: 11,
    })
    expect(firstPage.endpoints.rows).toHaveLength(10)
    expect(secondPage.endpoints).toMatchObject({
      page: 2,
      pageCount: 2,
      pageSize: 10,
      total: 11,
    })
    expect(secondPage.endpoints.rows).toHaveLength(1)
  })

  it("applies only explicit column filters", async () => {
    const unique = `admin-filter-${crypto.randomUUID()}`
    const owner = await createTrackedUser(`${unique}-owner`)
    const endpoint = await createTrackedEndpoint({ ownerUserId: owner.id })
    await renameEndpoint(endpoint.endpointId, `${unique}-endpoint`)
    await saveTrackedRequest({
      bodyText: `${unique} body`,
      endpointId: endpoint.endpointId,
      method: "POST",
      path: `/${unique}/path-that-is-not-filtered`,
      url: `/${unique}/path-that-is-not-filtered`,
    })

    const matching = await getAdminDashboardData({
      requests: {
        filters: {
          endpoint: unique,
          method: "POST",
          owner: owner.email,
        },
        pageSize: 100,
      },
    })
    const wrongMethod = await getAdminDashboardData({
      requests: {
        filters: {
          endpoint: unique,
          method: "GET",
          owner: owner.email,
        },
        pageSize: 100,
      },
    })
    const ignoredPathFilter = await getAdminDashboardData({
      requests: {
        filters: {
          endpoint: unique,
          method: "POST",
          owner: owner.email,
          path: "does-not-exist",
        } as never,
        pageSize: 100,
      },
    })

    expect(matching.requests.rows.map((row) => row.endpointId)).toEqual([
      endpoint.endpointId,
    ])
    expect(wrongMethod.requests.rows).toEqual([])
    expect(
      ignoredPathFilter.requests.rows.map((row) => row.endpointId)
    ).toEqual([endpoint.endpointId])
    expect(ignoredPathFilter.requests.filters).toEqual({
      endpoint: unique,
      method: "POST",
      owner: owner.email,
    })
  })

  it("normalizes unsupported table sorts to the supported server defaults", async () => {
    const dashboard = await getAdminDashboardData({
      endpoints: { sort: "requestCount" as never },
      requests: { sort: "path" as never },
      users: { sort: "requestCount" as never },
    })

    expect(dashboard.requests.sort).toBe("receivedAtTime")
    expect(dashboard.users.sort).toBe("createdAtTime")
    expect(dashboard.endpoints.sort).toBe("lastActivityAtTime")
  })
})

async function createTrackedUser(label: string) {
  const id = `test-admin-${label}-${crypto.randomUUID()}`
  const now = new Date()
  const row = {
    id,
    email: `${id}@example.com`,
    emailVerified: true,
    name: label,
    role: "user",
  }

  await getDatabase()
    .insert(user)
    .values({
      ...row,
      createdAt: now,
      updatedAt: now,
    })
  createdUserIds.push(id)

  return row
}

async function createTrackedAccount(userId: string, providerId: string) {
  const now = new Date()

  await getDatabase()
    .insert(account)
    .values({
      id: `account-${providerId}-${crypto.randomUUID()}`,
      accountId: `${providerId}-${userId}`,
      createdAt: now,
      providerId,
      updatedAt: now,
      userId,
    })
}

async function createTrackedEndpoint(
  options: Parameters<typeof createEndpoint>[0] = {
    anonymousSessionId: `session-${crypto.randomUUID()}`,
  }
) {
  const endpoint = await createEndpoint(options)
  createdEndpointIds.push(endpoint.endpointId)
  return endpoint
}

async function renameEndpoint(endpointId: string, name: string) {
  await getDatabase()
    .update(endpoints)
    .set({ name })
    .where(eq(endpoints.id, endpointId))
}

async function saveTrackedRequest(
  input: Partial<CapturedRequestInput> &
    Pick<CapturedRequestInput, "endpointId" | "method" | "path" | "url">
) {
  return saveCapturedRequest({
    bodyBase64: Buffer.from(input.bodyText ?? "").toString("base64"),
    bodySize: Buffer.byteLength(input.bodyText ?? ""),
    bodyText: "",
    contentType: null,
    headers: {},
    ip: null,
    query: {},
    ...input,
  })
}

async function createForwardTargets(endpointId: string) {
  const pendingTargetId = crypto.randomUUID()
  const failedTargetId = crypto.randomUUID()

  await getDatabase()
    .insert(endpointForwardTargets)
    .values([
      {
        endpointId,
        id: pendingTargetId,
        pathMode: "strip",
        url: "https://example.com/pending",
      },
      {
        endpointId,
        id: failedTargetId,
        pathMode: "strip",
        url: "https://example.com/failed",
      },
    ])
}
