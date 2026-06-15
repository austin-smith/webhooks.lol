import { inArray } from "drizzle-orm"
import { afterEach, describe, expect, it } from "vitest"

import { getDatabase } from "@webhooks-lol/database/client"
import { endpoints } from "@webhooks-lol/database/schema"
import {
  createEndpoint,
  listRequests,
  saveCapturedRequest,
} from "@webhooks-lol/webhooks-server/repository"
import { parseAdvancedRequestSearchQuery } from "@webhooks-lol/webhooks-core/request-search"
import type {
  CapturedRequest,
  CapturedRequestInput,
} from "@webhooks-lol/webhooks-core/types"

const createdEndpointIds: string[] = []

describe("webhook repository request search", () => {
  afterEach(async () => {
    if (createdEndpointIds.length === 0) {
      return
    }

    await getDatabase()
      .delete(endpoints)
      .where(inArray(endpoints.id, [...createdEndpointIds]))
    createdEndpointIds.length = 0
  })

  it("searches each supported field against persisted requests", async () => {
    const endpoint = await createTrackedEndpoint()
    const target = await saveTrackedRequest({
      endpointId: endpoint.endpointId,
      method: "POST",
      url: "/payments/created?customer_id=cus_123&source=stripe",
      path: "/payments/created",
      query: {
        customer_id: ["cus_123"],
        source: ["stripe"],
      },
      headers: {
        "content-type": "application/json",
        "x-stripe-signature": "sig_123",
      },
      bodyText: '{"event":"payment.created","customer_id":"cus_123"}',
      contentType: "application/json",
      ip: "203.0.113.7",
    })
    await saveTrackedRequest({
      endpointId: endpoint.endpointId,
      method: "GET",
      url: "/orders/list?status=open",
      path: "/orders/list",
      query: {
        status: ["open"],
      },
      headers: {
        accept: "text/plain",
      },
      bodyText: "not the payment payload",
      contentType: "text/plain",
      ip: "198.51.100.9",
    })

    const cases = [
      { field: "path", value: "/payments/created" },
      { field: "url", value: "customer_id=cus_123" },
      { field: "query", value: "cus_123" },
      { field: "headers", value: "x-stripe-signature" },
      { field: "body", value: "payment.created" },
      { field: "contentType", value: "application/json" },
      { field: "ip", value: "203.0.113.7" },
    ] as const

    for (const condition of cases) {
      const page = await listRequests(endpoint.endpointId, {
        search: {
          mode: "basic",
          methods: [],
          conditions: [condition],
        },
      })

      expect(page.requests.map((request) => request.id)).toEqual([target.id])
    }
  })

  it("combines method filters with OR and field filters with AND", async () => {
    const endpoint = await createTrackedEndpoint()
    const target = await saveTrackedRequest({
      endpointId: endpoint.endpointId,
      method: "POST",
      url: "/payments/created",
      path: "/payments/created",
      bodyText: '{"event":"payment.created"}',
    })
    await saveTrackedRequest({
      endpointId: endpoint.endpointId,
      method: "PUT",
      url: "/payments/created",
      path: "/payments/created",
      bodyText: '{"event":"invoice.created"}',
    })
    await saveTrackedRequest({
      endpointId: endpoint.endpointId,
      method: "POST",
      url: "/orders/created",
      path: "/orders/created",
      bodyText: '{"event":"payment.created"}',
    })

    await expectRequestIds(endpoint.endpointId, {
      expectedIds: [target.id],
      search: {
        mode: "basic",
        methods: ["POST", "PUT"],
        conditions: [
          { field: "path", value: "/payments" },
          { field: "body", value: "payment.created" },
        ],
      },
    })
    await expectRequestIds(endpoint.endpointId, {
      expectedIds: [],
      search: {
        mode: "basic",
        methods: ["GET"],
        conditions: [
          { field: "path", value: "/payments" },
          { field: "body", value: "payment.created" },
        ],
      },
    })
  })

  it("paginates searched request pages with the existing cursor contract", async () => {
    const endpoint = await createTrackedEndpoint()
    const first = await saveTrackedRequest({
      endpointId: endpoint.endpointId,
      method: "POST",
      url: "/pageable/one",
      path: "/pageable/one",
      bodyText: "pageable",
    })
    const second = await saveTrackedRequest({
      endpointId: endpoint.endpointId,
      method: "POST",
      url: "/pageable/two",
      path: "/pageable/two",
      bodyText: "pageable",
    })
    await saveTrackedRequest({
      endpointId: endpoint.endpointId,
      method: "POST",
      url: "/ignored",
      path: "/ignored",
      bodyText: "not pageable",
    })

    const firstPage = await listRequests(endpoint.endpointId, {
      limit: 1,
      search: {
        mode: "basic",
        methods: [],
        conditions: [{ field: "path", value: "/pageable" }],
      },
    })

    expect(firstPage.requests).toHaveLength(1)
    expect(firstPage.hasMore).toBe(true)
    expect(firstPage.nextCursor).not.toBeNull()
    expect([first.id, second.id]).toContain(firstPage.requests[0]?.id)

    const secondPage = await listRequests(endpoint.endpointId, {
      cursor: firstPage.nextCursor ?? undefined,
      limit: 1,
      search: {
        mode: "basic",
        methods: [],
        conditions: [{ field: "path", value: "/pageable" }],
      },
    })

    expect(secondPage.requests).toHaveLength(1)
    expect([first.id, second.id]).toContain(secondPage.requests[0]?.id)
    expect(secondPage.requests[0]?.id).not.toBe(firstPage.requests[0]?.id)
  })

  it("escapes literal LIKE wildcard and escape characters", async () => {
    const endpoint = await createTrackedEndpoint()
    const target = await saveTrackedRequest({
      endpointId: endpoint.endpointId,
      method: "POST",
      url: "/literal/%_slash\\value",
      path: "/literal/%_slash\\value",
      bodyText: "literal wildcard request",
    })
    await saveTrackedRequest({
      endpointId: endpoint.endpointId,
      method: "POST",
      url: "/literal/abslash-value",
      path: "/literal/abslash-value",
      bodyText: "similar wildcard request",
    })

    await expectRequestIds(endpoint.endpointId, {
      expectedIds: [target.id],
      search: {
        mode: "basic",
        methods: [],
        conditions: [{ field: "path", value: "%_" }],
      },
    })
    await expectRequestIds(endpoint.endpointId, {
      expectedIds: [target.id],
      search: {
        mode: "basic",
        methods: [],
        conditions: [{ field: "path", value: "\\" }],
      },
    })
  })

  it("searches advanced header and query key values against persisted requests", async () => {
    const endpoint = await createTrackedEndpoint()
    const target = await saveTrackedRequest({
      endpointId: endpoint.endpointId,
      method: "POST",
      url: "/events?source=alpha&source=beta",
      path: "/events",
      query: {
        source: ["alpha", "beta"],
      },
      headers: {
        "x-source": "runner",
        accept: "application/json",
      },
      bodyText: "event accepted",
    })
    await saveTrackedRequest({
      endpointId: endpoint.endpointId,
      method: "POST",
      url: "/events?source=gamma",
      path: "/events",
      query: {
        source: ["gamma"],
      },
      headers: {
        "x-source": "other",
        accept: "text/plain",
      },
      bodyText: "event accepted",
    })

    const search = parseAdvancedRequestSearchQuery(
      "method:POST AND headers.x-source:runner AND query.source:beta"
    )

    expect(search.kind).toBe("valid")

    if (search.kind !== "valid") {
      return
    }

    await expectRequestIds(endpoint.endpointId, {
      expectedIds: [target.id],
      search: search.value,
    })
  })

  it("searches advanced aggregate and key-value JSONB fields", async () => {
    const endpoint = await createTrackedEndpoint()
    const target = await saveTrackedRequest({
      endpointId: endpoint.endpointId,
      method: "POST",
      url: "/events?source=beta",
      path: "/events",
      query: {
        source: ["beta"],
      },
      headers: {
        "x-source": "runner",
      },
      bodyText: "event accepted",
    })
    await saveTrackedRequest({
      endpointId: endpoint.endpointId,
      method: "POST",
      url: "/events?other=gamma",
      path: "/events",
      query: {
        other: ["gamma"],
      },
      headers: {
        "x-other": "other",
      },
      bodyText: "event accepted",
    })

    const cases = [
      "headers:x-source",
      "headerName:x-source",
      "headerValue:runner",
      "query:source",
      "queryName:source",
      "queryValue:beta",
    ]

    for (const query of cases) {
      const search = parseAdvancedRequestSearchQuery(query)

      expect(search.kind).toBe("valid")

      if (search.kind !== "valid") {
        return
      }

      await expectRequestIds(endpoint.endpointId, {
        expectedIds: [target.id],
        search: search.value,
      })
    }
  })

  it("combines advanced search predicates with OR and NOT", async () => {
    const endpoint = await createTrackedEndpoint()
    const target = await saveTrackedRequest({
      endpointId: endpoint.endpointId,
      method: "PATCH",
      url: "/events/ready",
      path: "/events/ready",
      bodyText: "ready",
      ip: "203.0.113.10",
    })
    await saveTrackedRequest({
      endpointId: endpoint.endpointId,
      method: "PATCH",
      url: "/events/error",
      path: "/events/error",
      bodyText: "error",
      ip: "198.51.100.10",
    })

    const search = parseAdvancedRequestSearchQuery(
      "method:PATCH AND (body:ready OR path:/missing) AND NOT ip:198.51.100.10"
    )

    expect(search.kind).toBe("valid")

    if (search.kind !== "valid") {
      return
    }

    await expectRequestIds(endpoint.endpointId, {
      expectedIds: [target.id],
      search: search.value,
    })
  })
})

async function createTrackedEndpoint() {
  const endpoint = await createEndpoint()
  createdEndpointIds.push(endpoint.endpointId)
  return endpoint
}

async function saveTrackedRequest(
  input: Partial<CapturedRequestInput> &
    Pick<CapturedRequestInput, "endpointId" | "method" | "url" | "path">
) {
  return saveCapturedRequest({
    query: {},
    headers: {},
    bodyText: "",
    bodyBase64: Buffer.from(input.bodyText ?? "").toString("base64"),
    bodySize: Buffer.byteLength(input.bodyText ?? ""),
    contentType: null,
    ip: null,
    ...input,
  })
}

async function expectRequestIds(
  endpointId: string,
  {
    expectedIds,
    search,
  }: {
    expectedIds: string[]
    search: NonNullable<Parameters<typeof listRequests>[1]>["search"]
  }
) {
  const page = await listRequests(endpointId, { search })

  expect(readRequestIds(page.requests)).toEqual(expectedIds)
}

function readRequestIds(requests: CapturedRequest[]) {
  return requests.map((request) => request.id)
}
