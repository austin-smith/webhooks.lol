import type { Metadata } from "next"

import { AdminConsole } from "@/components/admin/admin-console"
import type { AdminConsoleData } from "@/components/admin/types"
import { Separator } from "@/components/ui/separator"
import {
  AuthenticationRequiredError,
  AuthorizationRequiredError,
  requireAdminSession,
} from "@/lib/auth/session"
import {
  ADMIN_TABLE_PAGE_SIZE_OPTIONS,
  getAdminDashboardData,
  type AdminDashboardQuery,
  type AdminDashboardData,
  type AdminEndpointFilters,
  type AdminEndpointOwnershipFilter,
  type AdminEndpointSort,
  type AdminRequestFilters,
  type AdminRequestSort,
  type AdminSortDirection,
  type AdminTableId,
  type AdminTablePage,
  type AdminTableQuery,
  type AdminUserFilters,
  type AdminUserSort,
  type AdminUserVerificationFilter,
} from "@webhooks-lol/webhooks-server/admin-reporting"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Admin | webhooks.lol",
}

type AdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const dashboardQuery = parseAdminDashboardQuery(await searchParams)
  const state = await getAdminPageState(dashboardQuery)

  if (state.kind === "authentication-required") {
    return (
      <AdminAccessGate
        title="Admin access"
        description="Sign in to access the admin dashboard."
      />
    )
  }

  if (state.kind === "authorization-required") {
    return (
      <AdminAccessGate
        title="Access denied"
        description="This account does not have admin access."
      />
    )
  }

  return (
    <AdminConsole
      dashboard={serializeAdminDashboard(state.dashboard)}
      key={state.dashboard.activeTable}
    />
  )
}

async function getAdminPageState(dashboardQuery: AdminDashboardQuery) {
  try {
    const session = await requireAdminSession()
    const dashboard = await getAdminDashboardData(dashboardQuery)

    return {
      kind: "dashboard" as const,
      dashboard,
      session,
    }
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return { kind: "authentication-required" as const }
    }

    if (error instanceof AuthorizationRequiredError) {
      return { kind: "authorization-required" as const }
    }

    throw error
  }
}

function serializeAdminDashboard(
  dashboard: AdminDashboardData
): AdminConsoleData {
  return {
    activeTable: dashboard.activeTable,
    overview: {
      ...dashboard.overview,
      payloadSizeLabel: formatBytes(dashboard.overview.payloadSizeBytes),
    },
    requests: {
      pagination: serializePagination(dashboard.requests),
      rows: dashboard.requests.rows.map((request) => ({
        endpointId: request.endpointId,
        endpointLabel: request.endpointName ?? "Untitled endpoint",
        id: request.id,
        ip: request.ip,
        method: request.method,
        ownerEmail: request.owner?.email ?? null,
        ownerName: request.owner?.name ?? null,
        path: request.path,
        receivedAtLabel: formatDateTime(request.receivedAt),
        receivedAtTime: request.receivedAt.getTime(),
      })),
    },
    users: {
      pagination: serializePagination(dashboard.users),
      rows: dashboard.users.rows.map((user) => ({
        createdAtLabel: formatDateTime(user.createdAt),
        createdAtTime: user.createdAt.getTime(),
        email: user.email,
        emailVerified: user.emailVerified,
        endpointCount: user.endpointCount,
        id: user.id,
        lastRequestAtLabel: formatOptionalDateTime(user.lastRequestAt),
        lastRequestAtTime: user.lastRequestAt?.getTime() ?? null,
        name: user.name,
        providerLabel:
          user.providerIds.length > 0 ? user.providerIds.join(", ") : "-",
        providerIds: user.providerIds,
        requestCount: user.requestCount,
        role: user.role,
        roleLabel: user.role ?? "No role",
      })),
    },
    endpoints: {
      pagination: serializePagination(dashboard.endpoints),
      rows: dashboard.endpoints.rows.map((endpoint) => ({
        endpointId: endpoint.endpointId,
        forwardTargetCount: endpoint.enabledForwardTargetCount,
        lastActivityAtLabel: formatDateTime(endpoint.lastActivityAt),
        lastActivityAtTime: endpoint.lastActivityAt.getTime(),
        name: endpoint.name ?? "Untitled endpoint",
        ownerEmail: endpoint.owner?.email ?? null,
        ownerName: endpoint.owner?.name ?? null,
        ownershipKind: endpoint.ownershipKind,
        requestCount: endpoint.requestCount,
      })),
    },
  }
}

function parseAdminDashboardQuery(
  searchParams: Record<string, string | string[] | undefined>
): AdminDashboardQuery {
  return {
    activeTable: parseActiveTable(readParam(searchParams.tab)),
    endpoints: parseTableQuery<AdminEndpointSort, AdminEndpointFilters>(
      searchParams,
      "e",
      {
        endpoint: readParam(searchParams.eEndpoint),
        owner: readParam(searchParams.eOwner),
        ownership: parseEndpointOwnershipFilter(
          readParam(searchParams.eOwnership)
        ),
      }
    ),
    requests: parseTableQuery<AdminRequestSort, AdminRequestFilters>(
      searchParams,
      "r",
      {
        endpoint: readParam(searchParams.rEndpoint),
        method: readParam(searchParams.rMethod),
        owner: readParam(searchParams.rOwner),
      }
    ),
    users: parseTableQuery<AdminUserSort, AdminUserFilters>(searchParams, "u", {
      user: readParam(searchParams.uUser),
      verified: parseVerificationFilter(readParam(searchParams.uVerified)),
    }),
  }
}

function parseTableQuery<TSort extends string, TFilters extends object>(
  searchParams: Record<string, string | string[] | undefined>,
  prefix: string,
  filters: TFilters
): AdminTableQuery<TSort, TFilters> {
  return {
    direction: parseDirection(readParam(searchParams[`${prefix}Dir`])),
    filters,
    page: parsePositiveInteger(readParam(searchParams[`${prefix}Page`])),
    pageSize: parsePageSize(readParam(searchParams[`${prefix}PageSize`])),
    sort: readParam(searchParams[`${prefix}Sort`]) as TSort | undefined,
  }
}

function serializePagination<
  TRow,
  TSort extends string,
  TFilters extends object,
>(page: AdminTablePage<TRow, TSort, TFilters>) {
  return {
    direction: page.direction,
    filters: page.filters,
    page: page.page,
    pageCount: page.pageCount,
    pageSize: page.pageSize,
    sort: page.sort,
    total: page.total,
  }
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parseActiveTable(value: string | undefined): AdminTableId | undefined {
  if (value === "endpoints" || value === "requests" || value === "users") {
    return value
  }

  return undefined
}

function parseDirection(value: string | undefined): AdminSortDirection {
  return value === "asc" ? "asc" : "desc"
}

function parseVerificationFilter(
  value: string | undefined
): AdminUserVerificationFilter | undefined {
  if (value === "verified" || value === "unverified") {
    return value
  }

  return undefined
}

function parseEndpointOwnershipFilter(
  value: string | undefined
): AdminEndpointOwnershipFilter | undefined {
  if (value === "anonymous" || value === "user-owned") {
    return value
  }

  return undefined
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return undefined
  }

  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function parsePageSize(value: string | undefined) {
  const parsed = parsePositiveInteger(value)

  return ADMIN_TABLE_PAGE_SIZE_OPTIONS.includes(parsed as never)
    ? parsed
    : undefined
}

function AdminAccessGate({
  description,
  title,
}: {
  description: string
  title: string
}) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs text-muted-foreground">webhooks.lol</p>
        <h1 className="font-heading text-lg">{title}</h1>
      </div>
      <Separator />
      <p className="text-sm text-muted-foreground">{description}</p>
    </main>
  )
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date)
}

function formatOptionalDateTime(date: Date | null) {
  return date ? formatDateTime(date) : "-"
}

function formatNumber(value: number) {
  return value.toLocaleString()
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${formatNumber(value)} B`
  }

  if (value < 1024 * 1024) {
    return `${formatCompactDecimal(value / 1024)} KiB`
  }

  return `${formatCompactDecimal(value / (1024 * 1024))} MiB`
}

function formatCompactDecimal(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  }).format(value)
}
