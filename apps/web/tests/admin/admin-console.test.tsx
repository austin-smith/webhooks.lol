import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { AdminConsole } from "@/components/admin/admin-console"
import type {
  AdminConsoleData,
  AdminTablePaginationView,
} from "@/components/admin/types"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

describe("AdminConsole", () => {
  it("renders the admin overview and request ownership with coherent labels", () => {
    const html = renderToStaticMarkup(
      <AdminConsole dashboard={createDashboard()} />
    )

    expect(html).toContain("Requests last 24h")
    expect(html).toContain("User-owned endpoints")
    expect(html).toContain("Anonymous endpoints")
    expect(html).toContain("Total payload size")
    expect(html.indexOf("Anonymous endpoints")).toBeLessThan(
      html.indexOf("Total payload size")
    )
    expect(html).toContain("owner@test.dev")
    expect(html).toContain("/checkout")
    expect(html).toContain("endpoint-owned")
    expect(html).toContain("User-owned")
    expect(html).toContain("Method")
    expect(html).toContain("Endpoint filter")
    expect(html).toContain("Owner filter")
    expect(html).toContain("Method filter")
    expect(html).not.toContain("No owner")
    expect(html).not.toContain("Unknown")
    expect(html).not.toContain("Unattributed")
    expect(html).not.toContain("unowned")
    expect(html).not.toContain("Guest endpoints")
    expect(html).not.toContain("Active sessions")
    expect(html).not.toContain("Banned users")
    expect(html).not.toContain("Request body bytes")
    expect(html).not.toContain("Filter actions")
    expect(html).not.toContain("Search requests")
    expect(html).not.toContain("Search users")
    expect(html).not.toContain("Search endpoints")
  })

  it("renders empty server-paginated tables without an invalid page range", () => {
    const dashboard = createDashboard()
    dashboard.requests = {
      pagination: createPagination({
        sort: "receivedAtTime",
        total: 0,
      }),
      rows: [],
    }

    const html = renderToStaticMarkup(<AdminConsole dashboard={dashboard} />)

    expect(html).toContain("0-0 of 0 rows")
    expect(html).toContain("0 / 0")
    expect(html).not.toContain("1 / 0")
  })
})

function createDashboard(): AdminConsoleData {
  return {
    activeTable: "requests",
    endpoints: {
      pagination: createPagination({
        sort: "lastActivityAtTime",
        total: 2,
      }),
      rows: [
        {
          endpointId: "endpoint-owned",
          forwardTargetCount: 2,
          lastActivityAtLabel: "6/21/26, 10:00:00 PM",
          lastActivityAtTime: 1782098400000,
          name: "Production checkout",
          ownerEmail: "owner@test.dev",
          ownerName: "Owner",
          ownershipKind: "user-owned",
          requestCount: 3,
        },
      ],
    },
    overview: {
      anonymousEndpoints: 1,
      endpoints: 2,
      payloadSizeBytes: 18432,
      payloadSizeLabel: "18 KiB",
      requests: 12,
      requestsLast24h: 4,
      userOwnedEndpoints: 1,
      users: 3,
      verifiedUsers: 2,
    },
    requests: {
      pagination: createPagination({
        sort: "receivedAtTime",
        total: 12,
      }),
      rows: [
        {
          endpointId: "endpoint-owned",
          endpointLabel: "Production checkout",
          id: "request-1",
          ip: "203.0.113.9",
          method: "POST",
          ownerEmail: "owner@test.dev",
          ownerName: "Owner",
          path: "/checkout",
          receivedAtLabel: "6/21/26, 10:00:00 PM",
          receivedAtTime: 1782098400000,
        },
        {
          endpointId: "endpoint-anonymous",
          endpointLabel: "Legacy endpoint",
          id: "request-2",
          ip: null,
          method: "GET",
          ownerEmail: null,
          ownerName: null,
          path: "/legacy",
          receivedAtLabel: "6/21/26, 9:30:00 PM",
          receivedAtTime: 1782096600000,
        },
      ],
    },
    users: {
      pagination: createPagination({
        sort: "createdAtTime",
        total: 3,
      }),
      rows: [
        {
          createdAtLabel: "6/21/26, 9:00:00 PM",
          createdAtTime: 1782094800000,
          email: "owner@test.dev",
          emailVerified: true,
          endpointCount: 1,
          id: "user-owner",
          lastRequestAtLabel: "6/21/26, 10:00:00 PM",
          lastRequestAtTime: 1782098400000,
          name: "Owner",
          providerIds: ["credential"],
          providerLabel: "credential",
          requestCount: 3,
          role: "user",
          roleLabel: "user",
        },
      ],
    },
  }
}

function createPagination<TSort extends string>({
  sort,
  total,
}: {
  sort: TSort
  total: number
}): AdminTablePaginationView<TSort, Record<never, never>> {
  return {
    direction: "desc",
    filters: {},
    page: 1,
    pageCount: Math.ceil(total / 25),
    pageSize: 25,
    sort,
    total,
  }
}
