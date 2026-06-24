export type AdminOwnershipKind = "anonymous" | "user-owned"
export type AdminEndpointOwnershipFilter = AdminOwnershipKind
export type AdminUserVerificationFilter = "unverified" | "verified"
export type AdminSortDirection = "asc" | "desc"
export type AdminTableId = "endpoints" | "requests" | "users"
export type AdminRequestSort = "receivedAtTime"
export type AdminUserSort = "createdAtTime" | "email"
export type AdminEndpointSort = "lastActivityAtTime"

export type AdminRequestFilters = {
  endpoint?: string
  method?: string
  owner?: string
}

export type AdminUserFilters = {
  user?: string
  verified?: AdminUserVerificationFilter
}

export type AdminEndpointFilters = {
  endpoint?: string
  owner?: string
  ownership?: AdminEndpointOwnershipFilter
}

export type AdminTablePaginationView<TSort extends string, TFilters> = {
  direction: AdminSortDirection
  filters: TFilters
  page: number
  pageCount: number
  pageSize: number
  sort: TSort
  total: number
}

export type AdminTableView<TRow, TSort extends string, TFilters> = {
  pagination: AdminTablePaginationView<TSort, TFilters>
  rows: TRow[]
}

export type AdminOverviewView = {
  anonymousEndpoints: number
  endpoints: number
  payloadSizeBytes: number
  payloadSizeLabel: string
  requests: number
  requestsLast24h: number
  userOwnedEndpoints: number
  users: number
  verifiedUsers: number
}

export type AdminRequestRow = {
  endpointId: string
  endpointLabel: string
  id: string
  ip: string | null
  method: string
  ownerEmail: string | null
  ownerName: string | null
  path: string
  receivedAtLabel: string
  receivedAtTime: number
}

export type AdminUserRow = {
  createdAtLabel: string
  createdAtTime: number
  email: string
  emailVerified: boolean
  endpointCount: number
  id: string
  lastRequestAtLabel: string
  lastRequestAtTime: number | null
  name: string
  providerIds: string[]
  providerLabel: string
  requestCount: number
  role: string | null
  roleLabel: string
}

export type AdminEndpointRow = {
  endpointId: string
  forwardTargetCount: number
  lastActivityAtLabel: string
  lastActivityAtTime: number
  name: string
  ownerEmail: string | null
  ownerName: string | null
  ownershipKind: AdminOwnershipKind
  requestCount: number
}

export type AdminConsoleData = {
  activeTable: AdminTableId
  endpoints: AdminTableView<
    AdminEndpointRow,
    AdminEndpointSort,
    AdminEndpointFilters
  >
  overview: AdminOverviewView
  requests: AdminTableView<
    AdminRequestRow,
    AdminRequestSort,
    AdminRequestFilters
  >
  users: AdminTableView<AdminUserRow, AdminUserSort, AdminUserFilters>
}
