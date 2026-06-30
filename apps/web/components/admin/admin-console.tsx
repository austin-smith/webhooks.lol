"use client"

import { useState, type ReactNode } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { BracesIcon, UsersIcon, WebhookIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RequestMethodBadge } from "@/components/webhook-inspector/request-method-badge"

import type {
  AdminConsoleData,
  AdminEndpointFilters,
  AdminEndpointRow,
  AdminOverviewView,
  AdminOwnershipKind,
  AdminRequestFilters,
  AdminRequestRow,
  AdminSortDirection,
  AdminTableId,
  AdminUserFilters,
  AdminUserRow,
} from "./types"

const ALL_FILTER_VALUE = "__all"
const REQUEST_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const

const requestColumns: ColumnDef<AdminRequestRow>[] = [
  {
    accessorKey: "receivedAtTime",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.receivedAtLabel}</span>
    ),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Time" />
    ),
  },
  {
    accessorKey: "method",
    cell: ({ row }) => <RequestMethodBadge method={row.original.method} />,
    enableSorting: false,
    header: "Method",
  },
  {
    accessorKey: "path",
    cell: ({ row }) => (
      <span className="block max-w-96 truncate font-mono text-xs">
        {row.original.path}
      </span>
    ),
    enableSorting: false,
    header: "Path",
  },
  {
    accessorFn: (row) => row.endpointLabel,
    cell: ({ row }) => (
      <EntityCell
        primary={row.original.endpointLabel}
        secondary={row.original.endpointId}
      />
    ),
    enableSorting: false,
    header: "Endpoint",
    id: "endpoint",
  },
  {
    accessorFn: (row) => row.ownerEmail ?? "",
    cell: ({ row }) => (
      <OwnerCell
        ownerEmail={row.original.ownerEmail}
        ownerName={row.original.ownerName}
      />
    ),
    enableSorting: false,
    header: "Owner",
    id: "owner",
  },
  {
    accessorKey: "ip",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.ip ?? "-"}
      </span>
    ),
    enableSorting: false,
    header: "IP",
  },
]

const userColumns: ColumnDef<AdminUserRow>[] = [
  {
    accessorKey: "email",
    cell: ({ row }) => (
      <EntityCell primary={row.original.email} secondary={row.original.name} />
    ),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="User" />
    ),
  },
  {
    accessorKey: "createdAtTime",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.createdAtLabel}</span>
    ),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Joined" />
    ),
  },
  {
    accessorKey: "emailVerified",
    cell: ({ row }) => (
      <Badge variant={row.original.emailVerified ? "secondary" : "outline"}>
        {row.original.emailVerified ? "Verified" : "Unverified"}
      </Badge>
    ),
    enableSorting: false,
    header: "Email",
  },
  {
    accessorKey: "roleLabel",
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.roleLabel}</Badge>
    ),
    enableSorting: false,
    header: "Role",
  },
  {
    accessorKey: "endpointCount",
    cell: ({ row }) => <NumberCell value={row.original.endpointCount} />,
    enableSorting: false,
    header: () => <div className="text-right">Endpoints</div>,
  },
  {
    accessorKey: "requestCount",
    cell: ({ row }) => <NumberCell value={row.original.requestCount} />,
    enableSorting: false,
    header: () => <div className="text-right">Requests</div>,
  },
  {
    accessorKey: "lastRequestAtTime",
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.original.lastRequestAtLabel}
      </span>
    ),
    enableSorting: false,
    header: "Last request",
  },
  {
    accessorKey: "providerLabel",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.providerLabel}
      </span>
    ),
    enableSorting: false,
    header: "Providers",
  },
]

const endpointColumns: ColumnDef<AdminEndpointRow>[] = [
  {
    accessorKey: "name",
    cell: ({ row }) => (
      <EntityCell
        primary={row.original.name}
        secondary={row.original.endpointId}
      />
    ),
    enableSorting: false,
    header: "Endpoint",
  },
  {
    accessorFn: (row) => row.ownerEmail ?? "",
    cell: ({ row }) => (
      <OwnerCell
        ownerEmail={row.original.ownerEmail}
        ownerName={row.original.ownerName}
      />
    ),
    enableSorting: false,
    header: "Owner",
    id: "owner",
  },
  {
    accessorKey: "ownershipKind",
    cell: ({ row }) => <OwnershipBadge kind={row.original.ownershipKind} />,
    enableSorting: false,
    header: "Ownership",
  },
  {
    accessorKey: "requestCount",
    cell: ({ row }) => <NumberCell value={row.original.requestCount} />,
    enableSorting: false,
    header: () => <div className="text-right">Requests</div>,
  },
  {
    accessorKey: "forwardTargetCount",
    cell: ({ row }) => <NumberCell value={row.original.forwardTargetCount} />,
    enableSorting: false,
    header: () => <div className="text-right">Forward targets</div>,
  },
  {
    accessorKey: "lastActivityAtTime",
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.original.lastActivityAtLabel}
      </span>
    ),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last activity" />
    ),
  },
]

export function AdminConsole({ dashboard }: { dashboard: AdminConsoleData }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [activeTable, setActiveTableState] = useState(dashboard.activeTable)

  function replaceAdminParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams)

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }

    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    })
  }

  function setActiveTable(table: AdminTableId) {
    setActiveTableState(table)
    replaceAdminParams({ tab: table })
  }

  function setTablePage(table: AdminTableId, page: number) {
    replaceAdminParams({
      [`${getTablePrefix(table)}Page`]: String(page),
      tab: table,
    })
  }

  function setTablePageSize(table: AdminTableId, pageSize: number) {
    const prefix = getTablePrefix(table)

    replaceAdminParams({
      [`${prefix}Page`]: null,
      [`${prefix}PageSize`]: String(pageSize),
      tab: table,
    })
  }

  function setTableSort(
    table: AdminTableId,
    sort: { direction: AdminSortDirection; id: string }
  ) {
    const prefix = getTablePrefix(table)

    replaceAdminParams({
      [`${prefix}Dir`]: sort.direction === "asc" ? "asc" : null,
      [`${prefix}Page`]: null,
      [`${prefix}Sort`]: sort.id,
      tab: table,
    })
  }

  function setRequestFilters(filters: AdminRequestFilters) {
    replaceAdminParams({
      rEndpoint: cleanParam(filters.endpoint),
      rMethod: cleanParam(filters.method),
      rOwner: cleanParam(filters.owner),
      rPage: null,
      tab: "requests",
    })
  }

  function setUserFilters(filters: AdminUserFilters) {
    replaceAdminParams({
      tab: "users",
      uPage: null,
      uUser: cleanParam(filters.user),
      uVerified: cleanParam(filters.verified),
    })
  }

  function setEndpointFilters(filters: AdminEndpointFilters) {
    replaceAdminParams({
      eEndpoint: cleanParam(filters.endpoint),
      eOwner: cleanParam(filters.owner),
      eOwnership: cleanParam(filters.ownership),
      ePage: null,
      tab: "endpoints",
    })
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl">Admin</h1>
          <p className="font-mono text-xs text-muted-foreground">
            App-wide activity
          </p>
        </div>
      </header>

      <OverviewPanel overview={dashboard.overview} />

      <Tabs
        value={activeTable}
        onValueChange={(value) => setActiveTable(value as AdminTableId)}
        className="gap-4"
      >
        <div className="min-w-0 overflow-x-auto overflow-y-hidden">
          <TabsList className="justify-start gap-1">
            <TabsTrigger value="requests">
              <BracesIcon data-icon="inline-start" aria-hidden="true" />
              Requests
            </TabsTrigger>
            <TabsTrigger value="endpoints">
              <WebhookIcon data-icon="inline-start" aria-hidden="true" />
              Endpoints
            </TabsTrigger>
            <TabsTrigger value="users">
              <UsersIcon data-icon="inline-start" aria-hidden="true" />
              Users
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="requests">
          <AdminTablePanel title="Requests">
            <DataTable
              columns={requestColumns}
              data={dashboard.requests.rows}
              onPageChange={(page) => setTablePage("requests", page)}
              onPageSizeChange={(pageSize) =>
                setTablePageSize("requests", pageSize)
              }
              onSortChange={(sort) => setTableSort("requests", sort)}
              columnFilters={createRequestColumnFilters({
                filters: dashboard.requests.pagination.filters,
                onChange: setRequestFilters,
              })}
              pagination={dashboard.requests.pagination}
            />
          </AdminTablePanel>
        </TabsContent>

        <TabsContent value="endpoints">
          <AdminTablePanel title="Endpoints">
            <DataTable
              columns={endpointColumns}
              data={dashboard.endpoints.rows}
              onPageChange={(page) => setTablePage("endpoints", page)}
              onPageSizeChange={(pageSize) =>
                setTablePageSize("endpoints", pageSize)
              }
              onSortChange={(sort) => setTableSort("endpoints", sort)}
              columnFilters={createEndpointColumnFilters({
                filters: dashboard.endpoints.pagination.filters,
                onChange: setEndpointFilters,
              })}
              pagination={dashboard.endpoints.pagination}
            />
          </AdminTablePanel>
        </TabsContent>

        <TabsContent value="users">
          <AdminTablePanel title="Users">
            <DataTable
              columns={userColumns}
              data={dashboard.users.rows}
              onPageChange={(page) => setTablePage("users", page)}
              onPageSizeChange={(pageSize) =>
                setTablePageSize("users", pageSize)
              }
              onSortChange={(sort) => setTableSort("users", sort)}
              columnFilters={createUserColumnFilters({
                filters: dashboard.users.pagination.filters,
                onChange: setUserFilters,
              })}
              pagination={dashboard.users.pagination}
            />
          </AdminTablePanel>
        </TabsContent>
      </Tabs>
    </main>
  )
}

function cleanParam(value: string | null | undefined) {
  const trimmed = value?.trim()

  return trimmed ? trimmed : null
}

function createRequestColumnFilters({
  filters,
  onChange,
}: {
  filters: AdminRequestFilters
  onChange: (filters: AdminRequestFilters) => void
}) {
  return {
    endpoint: (
      <ColumnTextFilter
        key={filters.endpoint ?? ""}
        label="Endpoint filter"
        value={filters.endpoint}
        placeholder="Name or ID"
        onCommit={(endpoint) => onChange({ ...filters, endpoint })}
      />
    ),
    owner: (
      <ColumnTextFilter
        key={filters.owner ?? ""}
        label="Owner filter"
        value={filters.owner}
        placeholder="Email or name"
        onCommit={(owner) => onChange({ ...filters, owner })}
      />
    ),
    method: (
      <ColumnSelectFilter
        label="Method filter"
        value={filters.method}
        placeholder="Any"
        onChange={(method) => onChange({ ...filters, method })}
        options={REQUEST_METHODS.map((method) => ({
          label: method,
          value: method,
        }))}
      />
    ),
  }
}

function createUserColumnFilters({
  filters,
  onChange,
}: {
  filters: AdminUserFilters
  onChange: (filters: AdminUserFilters) => void
}) {
  return {
    email: (
      <ColumnTextFilter
        key={filters.user ?? ""}
        label="User filter"
        value={filters.user}
        placeholder="Email or name"
        onCommit={(user) => onChange({ ...filters, user })}
      />
    ),
    emailVerified: (
      <ColumnSelectFilter
        label="Email status filter"
        value={filters.verified}
        placeholder="Any"
        onChange={(verified) =>
          onChange({
            ...filters,
            verified: verified as AdminUserFilters["verified"],
          })
        }
        options={[
          { label: "Verified", value: "verified" },
          { label: "Unverified", value: "unverified" },
        ]}
      />
    ),
  }
}

function createEndpointColumnFilters({
  filters,
  onChange,
}: {
  filters: AdminEndpointFilters
  onChange: (filters: AdminEndpointFilters) => void
}) {
  return {
    name: (
      <ColumnTextFilter
        key={filters.endpoint ?? ""}
        label="Endpoint filter"
        value={filters.endpoint}
        placeholder="Name or ID"
        onCommit={(endpoint) => onChange({ ...filters, endpoint })}
      />
    ),
    owner: (
      <ColumnTextFilter
        key={filters.owner ?? ""}
        label="Owner filter"
        value={filters.owner}
        placeholder="Email or name"
        onCommit={(owner) => onChange({ ...filters, owner })}
      />
    ),
    ownershipKind: (
      <ColumnSelectFilter
        label="Ownership filter"
        value={filters.ownership}
        placeholder="Any"
        onChange={(ownership) =>
          onChange({
            ...filters,
            ownership: ownership as AdminEndpointFilters["ownership"],
          })
        }
        options={[
          { label: "User-owned", value: "user-owned" },
          { label: "Anonymous", value: "anonymous" },
        ]}
      />
    ),
  }
}

function ColumnTextFilter({
  label,
  onCommit,
  placeholder,
  value,
}: {
  label: string
  onCommit: (value: string | undefined) => void
  placeholder: string
  value: string | undefined
}) {
  const [draft, setDraft] = useState(value ?? "")

  function commit() {
    const nextValue = cleanParam(draft) ?? undefined
    const currentValue = cleanParam(value) ?? undefined

    if (nextValue !== currentValue) {
      onCommit(nextValue)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        commit()
      }}
    >
      <label>
        <span className="sr-only">{label}</span>
        <Input
          density="compact"
          value={draft}
          onBlur={commit}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
        />
      </label>
    </form>
  )
}

function ColumnSelectFilter({
  label,
  onChange,
  options,
  placeholder,
  value,
}: {
  label: string
  onChange: (value: string | undefined) => void
  options: Array<{ label: string; value: string }>
  placeholder: string
  value: string | undefined
}) {
  return (
    <Select
      value={value ?? ALL_FILTER_VALUE}
      onValueChange={(nextValue) =>
        onChange(nextValue === ALL_FILTER_VALUE ? undefined : nextValue)
      }
    >
      <SelectTrigger size="sm" className="w-full" aria-label={label}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={ALL_FILTER_VALUE}>{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function getTablePrefix(table: AdminTableId) {
  if (table === "endpoints") {
    return "e"
  }

  if (table === "users") {
    return "u"
  }

  return "r"
}

function AdminTablePanel({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-base">{title}</h2>
      {children}
    </section>
  )
}

function OverviewPanel({ overview }: { overview: AdminOverviewView }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricTile label="Requests" value={overview.requests} />
      <MetricTile label="Requests last 24h" value={overview.requestsLast24h} />
      <MetricTile label="Users" value={overview.users} />
      <MetricTile label="Verified users" value={overview.verifiedUsers} />
      <MetricTile label="Endpoints" value={overview.endpoints} />
      <MetricTile
        label="User-owned endpoints"
        value={overview.userOwnedEndpoints}
      />
      <MetricTile
        label="Anonymous endpoints"
        value={overview.anonymousEndpoints}
      />
      <MetricTile
        label="Total payload size"
        value={overview.payloadSizeLabel}
      />
    </section>
  )
}

function MetricTile({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <Card size="xs">
      <CardContent className="flex flex-col gap-1">
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
        <div className="truncate font-mono text-xl">{formatMetric(value)}</div>
      </CardContent>
    </Card>
  )
}

function OwnerCell({
  ownerEmail,
  ownerName,
}: {
  ownerEmail: string | null
  ownerName: string | null
}) {
  if (!ownerEmail) {
    return <span className="text-muted-foreground">-</span>
  }

  return <EntityCell primary={ownerEmail} secondary={ownerName} />
}

function OwnershipBadge({ kind }: { kind: AdminOwnershipKind }) {
  if (kind === "user-owned") {
    return <Badge>User-owned</Badge>
  }

  return <Badge variant="secondary">Anonymous</Badge>
}

function EntityCell({
  primary,
  secondary,
}: {
  primary: string
  secondary: string | null
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate">{primary}</span>
      {secondary ? (
        <span className="truncate font-mono text-xs text-muted-foreground">
          {secondary}
        </span>
      ) : null}
    </div>
  )
}

function NumberCell({ value }: { value: number }) {
  return <div className="text-right font-mono">{value.toLocaleString()}</div>
}

function formatMetric(value: number | string) {
  return typeof value === "number" ? value.toLocaleString() : value
}
