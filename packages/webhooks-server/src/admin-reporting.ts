import "server-only"

import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNotNull,
  max,
  or,
  sql,
  type SQL,
} from "drizzle-orm"

import { getDatabase } from "@webhooks-lol/database/client"
import {
  account as authAccounts,
  capturedRequests,
  endpointForwardTargets,
  endpoints,
  user as authUsers,
} from "@webhooks-lol/database/schema"

export const ADMIN_TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

const DEFAULT_ADMIN_PAGE = 1
const DEFAULT_ADMIN_PAGE_SIZE = 25
const MAX_ADMIN_FILTER_LENGTH = 120

export type AdminOwnershipKind = "anonymous" | "unknown" | "user-owned"
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

export type AdminTableQuery<
  TSort extends string,
  TFilters extends object = Record<never, never>,
> = {
  direction?: AdminSortDirection
  filters?: TFilters
  page?: number
  pageSize?: number
  sort?: TSort
}

export type AdminDashboardQuery = {
  activeTable?: AdminTableId
  endpoints?: AdminTableQuery<AdminEndpointSort, AdminEndpointFilters>
  requests?: AdminTableQuery<AdminRequestSort, AdminRequestFilters>
  users?: AdminTableQuery<AdminUserSort, AdminUserFilters>
}

export type AdminOwnerSummary = {
  email: string
  emailVerified: boolean
  id: string
  name: string
  role: string | null
}

export type AdminOverview = {
  anonymousEndpoints: number
  endpoints: number
  payloadSizeBytes: number
  requests: number
  requestsLast24h: number
  userOwnedEndpoints: number
  users: number
  verifiedUsers: number
}

export type AdminRequestRow = {
  endpointId: string
  endpointName: string | null
  id: string
  ip: string | null
  method: string
  owner: AdminOwnerSummary | null
  ownershipKind: AdminOwnershipKind
  path: string
  receivedAt: Date
}

export type AdminUserRow = AdminOwnerSummary & {
  createdAt: Date
  endpointCount: number
  lastRequestAt: Date | null
  providerIds: string[]
  requestCount: number
}

export type AdminEndpointRow = {
  anonymousSessionHint: string | null
  enabledForwardTargetCount: number
  endpointId: string
  lastActivityAt: Date
  name: string | null
  owner: AdminOwnerSummary | null
  ownershipKind: AdminOwnershipKind
  requestCount: number
}

export type AdminTablePage<
  TRow,
  TSort extends string,
  TFilters extends object,
> = {
  direction: AdminSortDirection
  filters: TFilters
  page: number
  pageCount: number
  pageSize: number
  rows: TRow[]
  sort: TSort
  total: number
}

export type AdminDashboardData = {
  activeTable: AdminTableId
  endpoints: AdminTablePage<
    AdminEndpointRow,
    AdminEndpointSort,
    AdminEndpointFilters
  >
  overview: AdminOverview
  requests: AdminTablePage<
    AdminRequestRow,
    AdminRequestSort,
    AdminRequestFilters
  >
  users: AdminTablePage<AdminUserRow, AdminUserSort, AdminUserFilters>
}

type NormalizedTableQuery<
  TSort extends string,
  TFilters extends object,
> = Required<AdminTableQuery<TSort, TFilters>>

type SqlOrderBy = SQL<unknown>

export async function getAdminDashboardData(
  query: AdminDashboardQuery = {}
): Promise<AdminDashboardData> {
  const now = new Date()
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const normalizedQuery = normalizeDashboardQuery(query)

  const [overview, requests, users, endpointRows] = await Promise.all([
    getAdminOverview({ since24h }),
    listAdminRequests(normalizedQuery.requests),
    listAdminUsers(normalizedQuery.users),
    listAdminEndpoints(normalizedQuery.endpoints),
  ])

  return {
    activeTable: normalizedQuery.activeTable,
    endpoints: endpointRows,
    overview,
    requests,
    users,
  }
}

async function getAdminOverview({
  since24h,
}: {
  since24h: Date
}): Promise<AdminOverview> {
  const database = getDatabase()

  const [requestCounts, requestsLast24hCount, endpointCounts, userCounts] =
    await Promise.all([
      database
        .select({
          payloadSizeBytes:
            sql<number>`cast(coalesce(sum(${capturedRequests.bodySize}), 0) as double precision)`.as(
              "payload_size_bytes"
            ),
          requests: sql<number>`cast(count(*) as double precision)`.as(
            "requests"
          ),
        })
        .from(capturedRequests),
      database
        .select({
          requestsLast24h: sql<number>`cast(count(*) as double precision)`.as(
            "requests_last_24h"
          ),
        })
        .from(capturedRequests)
        .where(gt(capturedRequests.receivedAt, since24h)),
      database
        .select({
          anonymousEndpoints:
            sql<number>`cast(count(*) filter (where ${endpoints.ownerUserId} is null and ${endpoints.anonymousSessionId} is not null) as double precision)`.as(
              "anonymous_endpoints"
            ),
          endpoints: sql<number>`cast(count(*) as double precision)`.as(
            "endpoints"
          ),
          userOwnedEndpoints:
            sql<number>`cast(count(*) filter (where ${endpoints.ownerUserId} is not null) as double precision)`.as(
              "user_owned_endpoints"
            ),
        })
        .from(endpoints),
      database
        .select({
          users: sql<number>`cast(count(*) as double precision)`.as("users"),
          verifiedUsers:
            sql<number>`cast(count(*) filter (where ${authUsers.emailVerified} = true) as double precision)`.as(
              "verified_users"
            ),
        })
        .from(authUsers),
    ])

  return {
    anonymousEndpoints: Number(endpointCounts[0]?.anonymousEndpoints ?? 0),
    endpoints: Number(endpointCounts[0]?.endpoints ?? 0),
    payloadSizeBytes: Number(requestCounts[0]?.payloadSizeBytes ?? 0),
    requests: Number(requestCounts[0]?.requests ?? 0),
    requestsLast24h: Number(requestsLast24hCount[0]?.requestsLast24h ?? 0),
    userOwnedEndpoints: Number(endpointCounts[0]?.userOwnedEndpoints ?? 0),
    users: Number(userCounts[0]?.users ?? 0),
    verifiedUsers: Number(userCounts[0]?.verifiedUsers ?? 0),
  }
}

async function listAdminRequests(
  query: NormalizedTableQuery<AdminRequestSort, AdminRequestFilters>
): Promise<
  AdminTablePage<AdminRequestRow, AdminRequestSort, AdminRequestFilters>
> {
  const database = getDatabase()
  const where = createRequestFiltersWhere(query.filters)
  const totalRows = await database
    .select({
      total: sql<number>`cast(count(*) as double precision)`.as("total"),
    })
    .from(capturedRequests)
    .innerJoin(endpoints, eq(capturedRequests.endpointId, endpoints.id))
    .leftJoin(authUsers, eq(endpoints.ownerUserId, authUsers.id))
    .where(where)
  const total = Number(totalRows[0]?.total ?? 0)
  const page = clampPage(query.page, query.pageSize, total)

  const rows = await database
    .select({
      endpointId: capturedRequests.endpointId,
      endpointName: endpoints.name,
      endpointOwnerUserId: endpoints.ownerUserId,
      endpointAnonymousSessionId: endpoints.anonymousSessionId,
      id: capturedRequests.id,
      ip: capturedRequests.ip,
      method: capturedRequests.method,
      ownerEmail: authUsers.email,
      ownerEmailVerified: authUsers.emailVerified,
      ownerId: authUsers.id,
      ownerName: authUsers.name,
      ownerRole: authUsers.role,
      path: capturedRequests.path,
      receivedAt: capturedRequests.receivedAt,
    })
    .from(capturedRequests)
    .innerJoin(endpoints, eq(capturedRequests.endpointId, endpoints.id))
    .leftJoin(authUsers, eq(endpoints.ownerUserId, authUsers.id))
    .where(where)
    .orderBy(...getRequestOrderBy(query.direction))
    .limit(query.pageSize)
    .offset(getOffset({ page, pageSize: query.pageSize }))

  return {
    ...createPageMetadata({ page, pageSize: query.pageSize, total }),
    direction: query.direction,
    filters: query.filters,
    rows: rows.map((row) => ({
      endpointId: row.endpointId,
      endpointName: row.endpointName,
      id: row.id,
      ip: row.ip,
      method: row.method,
      owner: mapOwnerSummary(row),
      ownershipKind: getOwnershipKind({
        anonymousSessionId: row.endpointAnonymousSessionId,
        ownerUserId: row.endpointOwnerUserId,
      }),
      path: row.path,
      receivedAt: row.receivedAt,
    })),
    sort: query.sort,
  }
}

async function listAdminUsers(
  query: NormalizedTableQuery<AdminUserSort, AdminUserFilters>
): Promise<AdminTablePage<AdminUserRow, AdminUserSort, AdminUserFilters>> {
  const database = getDatabase()
  const userWebhookStats = createUserWebhookStats()
  const accountStats = createAccountStats()
  const where = createUserFiltersWhere(query.filters)

  const totalRows = await database
    .select({
      total: sql<number>`cast(count(*) as double precision)`.as("total"),
    })
    .from(authUsers)
    .leftJoin(userWebhookStats, eq(userWebhookStats.userId, authUsers.id))
    .leftJoin(accountStats, eq(accountStats.userId, authUsers.id))
    .where(where)
  const total = Number(totalRows[0]?.total ?? 0)
  const page = clampPage(query.page, query.pageSize, total)

  const rows = await database
    .select({
      createdAt: authUsers.createdAt,
      email: authUsers.email,
      emailVerified: authUsers.emailVerified,
      endpointCount: userWebhookStats.endpointCount,
      id: authUsers.id,
      lastRequestAt: userWebhookStats.lastRequestAt,
      name: authUsers.name,
      providerIds: accountStats.providerIds,
      requestCount: userWebhookStats.requestCount,
      role: authUsers.role,
    })
    .from(authUsers)
    .leftJoin(userWebhookStats, eq(userWebhookStats.userId, authUsers.id))
    .leftJoin(accountStats, eq(accountStats.userId, authUsers.id))
    .where(where)
    .orderBy(
      ...getUserOrderBy({
        direction: query.direction,
        sort: query.sort,
      })
    )
    .limit(query.pageSize)
    .offset(getOffset({ page, pageSize: query.pageSize }))

  return {
    ...createPageMetadata({ page, pageSize: query.pageSize, total }),
    direction: query.direction,
    filters: query.filters,
    rows: rows.map((row) => ({
      createdAt: row.createdAt,
      email: row.email,
      emailVerified: row.emailVerified,
      endpointCount: Number(row.endpointCount ?? 0),
      id: row.id,
      lastRequestAt: row.lastRequestAt,
      name: row.name,
      providerIds: splitProviderIds(row.providerIds),
      requestCount: Number(row.requestCount ?? 0),
      role: row.role,
    })),
    sort: query.sort,
  }
}

async function listAdminEndpoints(
  query: NormalizedTableQuery<AdminEndpointSort, AdminEndpointFilters>
): Promise<
  AdminTablePage<AdminEndpointRow, AdminEndpointSort, AdminEndpointFilters>
> {
  const database = getDatabase()
  const requestStats = createEndpointRequestStats()
  const targetStats = createEndpointTargetStats()
  const where = createEndpointFiltersWhere(query.filters)

  const totalRows = await database
    .select({
      total: sql<number>`cast(count(*) as double precision)`.as("total"),
    })
    .from(endpoints)
    .leftJoin(authUsers, eq(endpoints.ownerUserId, authUsers.id))
    .leftJoin(requestStats, eq(requestStats.endpointId, endpoints.id))
    .leftJoin(targetStats, eq(targetStats.endpointId, endpoints.id))
    .where(where)
  const total = Number(totalRows[0]?.total ?? 0)
  const page = clampPage(query.page, query.pageSize, total)

  const rows = await database
    .select({
      anonymousSessionId: endpoints.anonymousSessionId,
      enabledForwardTargetCount: targetStats.enabledForwardTargetCount,
      endpointId: endpoints.id,
      lastActivityAt: endpoints.lastActivityAt,
      name: endpoints.name,
      ownerEmail: authUsers.email,
      ownerEmailVerified: authUsers.emailVerified,
      ownerId: authUsers.id,
      ownerName: authUsers.name,
      ownerRole: authUsers.role,
      ownerUserId: endpoints.ownerUserId,
      requestCount: requestStats.requestCount,
    })
    .from(endpoints)
    .leftJoin(authUsers, eq(endpoints.ownerUserId, authUsers.id))
    .leftJoin(requestStats, eq(requestStats.endpointId, endpoints.id))
    .leftJoin(targetStats, eq(targetStats.endpointId, endpoints.id))
    .where(where)
    .orderBy(
      ...getEndpointOrderBy({
        direction: query.direction,
      })
    )
    .limit(query.pageSize)
    .offset(getOffset({ page, pageSize: query.pageSize }))

  return {
    ...createPageMetadata({ page, pageSize: query.pageSize, total }),
    direction: query.direction,
    filters: query.filters,
    rows: rows.map((row) => ({
      anonymousSessionHint: createAnonymousSessionHint(row.anonymousSessionId),
      enabledForwardTargetCount: Number(row.enabledForwardTargetCount ?? 0),
      endpointId: row.endpointId,
      lastActivityAt: row.lastActivityAt,
      name: row.name,
      owner: mapOwnerSummary(row),
      ownershipKind: getOwnershipKind({
        anonymousSessionId: row.anonymousSessionId,
        ownerUserId: row.ownerUserId,
      }),
      requestCount: Number(row.requestCount ?? 0),
    })),
    sort: query.sort,
  }
}

function createUserWebhookStats() {
  return getDatabase()
    .select({
      endpointCount:
        sql<number>`cast(count(distinct ${endpoints.id}) as double precision)`.as(
          "endpoint_count"
        ),
      lastRequestAt: max(capturedRequests.receivedAt).as("last_request_at"),
      requestCount:
        sql<number>`cast(count(${capturedRequests.id}) as double precision)`.as(
          "request_count"
        ),
      userId: endpoints.ownerUserId,
    })
    .from(endpoints)
    .leftJoin(capturedRequests, eq(capturedRequests.endpointId, endpoints.id))
    .where(isNotNull(endpoints.ownerUserId))
    .groupBy(endpoints.ownerUserId)
    .as("user_webhook_stats")
}

function createAccountStats() {
  return getDatabase()
    .select({
      providerIds:
        sql<string>`coalesce(string_agg(distinct ${authAccounts.providerId}, ',' order by ${authAccounts.providerId}), '')`.as(
          "provider_ids"
        ),
      userId: authAccounts.userId,
    })
    .from(authAccounts)
    .groupBy(authAccounts.userId)
    .as("account_stats")
}

function createEndpointRequestStats() {
  return getDatabase()
    .select({
      endpointId: capturedRequests.endpointId,
      requestCount:
        sql<number>`cast(count(${capturedRequests.id}) as double precision)`.as(
          "request_count"
        ),
    })
    .from(capturedRequests)
    .groupBy(capturedRequests.endpointId)
    .as("request_stats")
}

function createEndpointTargetStats() {
  return getDatabase()
    .select({
      enabledForwardTargetCount:
        sql<number>`cast(count(*) filter (where ${endpointForwardTargets.enabled} = true and ${endpointForwardTargets.deleted} = false) as double precision)`.as(
          "enabled_forward_target_count"
        ),
      endpointId: endpointForwardTargets.endpointId,
    })
    .from(endpointForwardTargets)
    .where(eq(endpointForwardTargets.deleted, false))
    .groupBy(endpointForwardTargets.endpointId)
    .as("target_stats")
}

function createRequestFiltersWhere(filters: AdminRequestFilters) {
  const conditions: SQL[] = []

  if (filters.method) {
    conditions.push(eq(capturedRequests.method, filters.method))
  }

  const endpointPattern = createFilterPattern(filters.endpoint)
  if (endpointPattern) {
    conditions.push(
      or(
        lowerLike(sql`${capturedRequests.endpointId}::text`, endpointPattern),
        lowerLike(sql`coalesce(${endpoints.name}, '')`, endpointPattern)
      ) ?? sql`false`
    )
  }

  const ownerPattern = createFilterPattern(filters.owner)
  if (ownerPattern) {
    conditions.push(
      or(
        lowerLike(sql`coalesce(${authUsers.email}, '')`, ownerPattern),
        lowerLike(sql`coalesce(${authUsers.name}, '')`, ownerPattern)
      ) ?? sql`false`
    )
  }

  return combineConditions(conditions)
}

function createUserFiltersWhere(filters: AdminUserFilters) {
  const conditions: SQL[] = []
  const userPattern = createFilterPattern(filters.user)

  if (userPattern) {
    conditions.push(
      or(
        lowerLike(sql`${authUsers.email}`, userPattern),
        lowerLike(sql`${authUsers.name}`, userPattern)
      ) ?? sql`false`
    )
  }

  if (filters.verified) {
    conditions.push(
      eq(authUsers.emailVerified, filters.verified === "verified")
    )
  }

  return combineConditions(conditions)
}

function createEndpointFiltersWhere(filters: AdminEndpointFilters) {
  const conditions: SQL[] = []
  const endpointPattern = createFilterPattern(filters.endpoint)

  if (endpointPattern) {
    conditions.push(
      or(
        lowerLike(sql`${endpoints.id}::text`, endpointPattern),
        lowerLike(sql`coalesce(${endpoints.name}, '')`, endpointPattern)
      ) ?? sql`false`
    )
  }

  const ownerPattern = createFilterPattern(filters.owner)
  if (ownerPattern) {
    conditions.push(
      or(
        lowerLike(sql`coalesce(${authUsers.email}, '')`, ownerPattern),
        lowerLike(sql`coalesce(${authUsers.name}, '')`, ownerPattern)
      ) ?? sql`false`
    )
  }

  if (filters.ownership) {
    conditions.push(sql`${ownershipExpression()} = ${filters.ownership}`)
  }

  return combineConditions(conditions)
}

function getRequestOrderBy(
  direction: AdminSortDirection
): [SqlOrderBy, SqlOrderBy] {
  const order = getOrder(direction)

  return [order(capturedRequests.receivedAt), desc(capturedRequests.id)]
}

function getUserOrderBy({
  direction,
  sort,
}: {
  direction: AdminSortDirection
  sort: AdminUserSort
}): [SqlOrderBy, SqlOrderBy] {
  const order = getOrder(direction)

  if (sort === "email") {
    return [order(authUsers.email), desc(authUsers.id)]
  }

  return [order(authUsers.createdAt), desc(authUsers.id)]
}

function getEndpointOrderBy({
  direction,
}: {
  direction: AdminSortDirection
}): [SqlOrderBy, SqlOrderBy] {
  const order = getOrder(direction)

  return [order(endpoints.lastActivityAt), desc(endpoints.id)]
}

function normalizeDashboardQuery(query: AdminDashboardQuery): {
  activeTable: AdminTableId
  endpoints: NormalizedTableQuery<AdminEndpointSort, AdminEndpointFilters>
  requests: NormalizedTableQuery<AdminRequestSort, AdminRequestFilters>
  users: NormalizedTableQuery<AdminUserSort, AdminUserFilters>
} {
  return {
    activeTable: normalizeActiveTable(query.activeTable),
    endpoints: normalizeTableQuery({
      defaultSort: "lastActivityAtTime",
      direction: query.endpoints?.direction,
      filters: normalizeEndpointFilters(query.endpoints?.filters),
      page: query.endpoints?.page,
      pageSize: query.endpoints?.pageSize,
      sort: query.endpoints?.sort,
      validSorts: ["lastActivityAtTime"],
    }),
    requests: normalizeTableQuery({
      defaultSort: "receivedAtTime",
      direction: query.requests?.direction,
      filters: normalizeRequestFilters(query.requests?.filters),
      page: query.requests?.page,
      pageSize: query.requests?.pageSize,
      sort: query.requests?.sort,
      validSorts: ["receivedAtTime"],
    }),
    users: normalizeTableQuery({
      defaultSort: "createdAtTime",
      direction: query.users?.direction,
      filters: normalizeUserFilters(query.users?.filters),
      page: query.users?.page,
      pageSize: query.users?.pageSize,
      sort: query.users?.sort,
      validSorts: ["createdAtTime", "email"],
    }),
  }
}

function normalizeTableQuery<TSort extends string, TFilters extends object>({
  defaultSort,
  direction,
  filters,
  page,
  pageSize,
  sort,
  validSorts,
}: AdminTableQuery<TSort, TFilters> & {
  defaultSort: TSort
  filters: TFilters
  validSorts: readonly TSort[]
}): NormalizedTableQuery<TSort, TFilters> {
  return {
    direction: direction === "asc" ? "asc" : "desc",
    filters,
    page: normalizePositiveInteger(page, DEFAULT_ADMIN_PAGE),
    pageSize: normalizePageSize(pageSize),
    sort: sort && validSorts.includes(sort) ? sort : defaultSort,
  }
}

function normalizeRequestFilters(
  filters: AdminRequestFilters | undefined
): AdminRequestFilters {
  return {
    endpoint: normalizeFilterText(filters?.endpoint),
    method: normalizeRequestMethod(filters?.method),
    owner: normalizeFilterText(filters?.owner),
  }
}

function normalizeUserFilters(
  filters: AdminUserFilters | undefined
): AdminUserFilters {
  return {
    user: normalizeFilterText(filters?.user),
    verified: normalizeVerificationFilter(filters?.verified),
  }
}

function normalizeEndpointFilters(
  filters: AdminEndpointFilters | undefined
): AdminEndpointFilters {
  return {
    endpoint: normalizeFilterText(filters?.endpoint),
    owner: normalizeFilterText(filters?.owner),
    ownership: normalizeEndpointOwnershipFilter(filters?.ownership),
  }
}

function normalizeActiveTable(table: AdminTableId | undefined): AdminTableId {
  if (table === "endpoints" || table === "users") {
    return table
  }

  return "requests"
}

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (!Number.isInteger(value) || !value || value < 1) {
    return fallback
  }

  return value
}

function normalizePageSize(value: number | undefined) {
  if (ADMIN_TABLE_PAGE_SIZE_OPTIONS.includes(value as never)) {
    return value as (typeof ADMIN_TABLE_PAGE_SIZE_OPTIONS)[number]
  }

  return DEFAULT_ADMIN_PAGE_SIZE
}

function normalizeFilterText(value: string | undefined) {
  const normalized = (value ?? "").trim().slice(0, MAX_ADMIN_FILTER_LENGTH)

  return normalized || undefined
}

function normalizeRequestMethod(value: string | undefined) {
  const normalized = normalizeFilterText(value)?.toUpperCase()

  if (!normalized || !/^[A-Z]+$/.test(normalized)) {
    return undefined
  }

  return normalized
}

function normalizeVerificationFilter(
  value: string | undefined
): AdminUserVerificationFilter | undefined {
  if (value === "verified" || value === "unverified") {
    return value
  }

  return undefined
}

function normalizeEndpointOwnershipFilter(
  value: string | undefined
): AdminEndpointOwnershipFilter | undefined {
  if (value === "anonymous" || value === "unknown" || value === "user-owned") {
    return value
  }

  return undefined
}

function clampPage(page: number, pageSize: number, total: number) {
  if (total === 0) {
    return 1
  }

  return Math.min(page, Math.ceil(total / pageSize))
}

function createPageMetadata({
  page,
  pageSize,
  total,
}: {
  page: number
  pageSize: number
  total: number
}) {
  return {
    page,
    pageCount: total > 0 ? Math.ceil(total / pageSize) : 0,
    pageSize,
    total,
  }
}

function getOffset({ page, pageSize }: { page: number; pageSize: number }) {
  return (page - 1) * pageSize
}

function getOrder(direction: AdminSortDirection) {
  return direction === "asc" ? asc : desc
}

function combineConditions(conditions: SQL[]) {
  return and(...conditions) ?? sql`true`
}

function lowerLike(value: SQL, pattern: string) {
  return sql`lower(${value}) like ${pattern} escape '\'`
}

function createFilterPattern(value: string | undefined) {
  if (!value) {
    return null
  }

  return `%${value.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`
}

function ownershipExpression() {
  return sql<string>`case
    when ${endpoints.ownerUserId} is not null then 'user-owned'
    when ${endpoints.anonymousSessionId} is not null then 'anonymous'
    else 'unknown'
  end`
}

function getOwnershipKind({
  anonymousSessionId,
  ownerUserId,
}: {
  anonymousSessionId: string | null
  ownerUserId: string | null
}): AdminOwnershipKind {
  if (ownerUserId) {
    return "user-owned"
  }

  if (anonymousSessionId) {
    return "anonymous"
  }

  return "unknown"
}

function mapOwnerSummary(row: {
  ownerEmail: string | null
  ownerEmailVerified: boolean | null
  ownerId: string | null
  ownerName: string | null
  ownerRole: string | null
}): AdminOwnerSummary | null {
  if (!row.ownerId || !row.ownerEmail || !row.ownerName) {
    return null
  }

  return {
    email: row.ownerEmail,
    emailVerified: Boolean(row.ownerEmailVerified),
    id: row.ownerId,
    name: row.ownerName,
    role: row.ownerRole,
  }
}

function splitProviderIds(providerIds: string | null) {
  return providerIds ? providerIds.split(",").filter(Boolean) : []
}

function createAnonymousSessionHint(anonymousSessionId: string | null) {
  if (!anonymousSessionId) {
    return null
  }

  if (anonymousSessionId.length <= 12) {
    return anonymousSessionId
  }

  return `${anonymousSessionId.slice(0, 6)}...${anonymousSessionId.slice(-6)}`
}
