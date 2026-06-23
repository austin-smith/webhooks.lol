import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

import { user } from "./auth-schema.js"

export const endpoints = pgTable(
  "endpoints",
  {
    id: uuid("id").primaryKey(),
    name: text("name"),
    ownerUserId: text("owner_user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    anonymousSessionId: text("anonymous_session_id"),
    creatorKeyHash: text("creator_key_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("endpoints_owner_user_id_last_activity_idx").on(
      table.ownerUserId,
      table.lastActivityAt.desc(),
      table.id.desc()
    ),
    index("endpoints_anonymous_session_id_last_activity_idx").on(
      table.anonymousSessionId,
      table.lastActivityAt.desc(),
      table.id.desc()
    ),
    check(
      "endpoints_single_identity_check",
      sql`num_nonnulls(${table.ownerUserId}, ${table.anonymousSessionId}) = 1`
    ),
  ]
)

export const capturedRequests = pgTable(
  "requests",
  {
    id: uuid("id").primaryKey(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => endpoints.id, { onDelete: "cascade" }),
    method: text("method").notNull(),
    url: text("url").notNull(),
    path: text("path").notNull(),
    query: jsonb("query").$type<Record<string, string[]>>().notNull(),
    headers: jsonb("headers").$type<Record<string, string>>().notNull(),
    bodyText: text("body_text").notNull(),
    bodyBase64: text("body_base64").notNull(),
    bodySize: integer("body_size").notNull(),
    contentType: text("content_type"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ip: text("ip"),
    deleteAfterForwarding: boolean("delete_after_forwarding")
      .notNull()
      .default(false),
  },
  (table) => [
    index("requests_endpoint_id_received_at_idx").on(
      table.endpointId,
      table.receivedAt.desc(),
      table.id.desc()
    ),
    index("requests_field_search_trgm_idx").using(
      "gin",
      table.endpointId.op("uuid_ops"),
      sql`lower(${table.path}) gin_trgm_ops`,
      sql`lower(${table.url}) gin_trgm_ops`,
      sql`lower(${table.headers}::text) gin_trgm_ops`,
      sql`lower(${table.query}::text) gin_trgm_ops`,
      sql`lower(${table.bodyText}) gin_trgm_ops`,
      sql`lower(coalesce(${table.contentType}, '')) gin_trgm_ops`,
      sql`lower(coalesce(${table.ip}, '')) gin_trgm_ops`
    ),
  ]
)

export const endpointResponses = pgTable(
  "endpoint_responses",
  {
    endpointId: uuid("endpoint_id")
      .primaryKey()
      .references(() => endpoints.id, { onDelete: "cascade" }),
    status: integer("status").notNull(),
    contentType: text("content_type").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "endpoint_responses_status_check",
      sql`${table.status} between 200 and 599`
    ),
    check(
      "endpoint_responses_content_type_check",
      sql`length(trim(${table.contentType})) > 0`
    ),
  ]
)

export const endpointForwardTargets = pgTable(
  "endpoint_forward_targets",
  {
    id: uuid("id").primaryKey(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => endpoints.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    pathMode: text("path_mode").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    deleted: boolean("deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("endpoint_forward_targets_endpoint_id_idx").on(table.endpointId),
    uniqueIndex("endpoint_forward_targets_endpoint_url_path_idx")
      .on(table.endpointId, table.url, table.pathMode)
      .where(sql`${table.deleted} = false`),
    check(
      "endpoint_forward_targets_path_mode_check",
      sql`${table.pathMode} in ('strip', 'preserve')`
    ),
    check(
      "endpoint_forward_targets_url_check",
      sql`length(trim(${table.url})) > 0`
    ),
  ]
)

export const endpointForwardDeliveries = pgTable(
  "endpoint_forward_deliveries",
  {
    id: uuid("id").primaryKey(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => endpoints.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => endpointForwardTargets.id, { onDelete: "cascade" }),
    requestId: uuid("request_id")
      .notNull()
      .references(() => capturedRequests.id, { onDelete: "cascade" }),
    targetUrl: text("target_url").notNull(),
    targetPathMode: text("target_path_mode").notNull(),
    status: text("status").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastStatus: integer("last_status"),
    lastError: text("last_error"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("endpoint_forward_deliveries_target_request_idx").on(
      table.targetId,
      table.requestId
    ),
    index("endpoint_forward_deliveries_endpoint_id_idx").on(table.endpointId),
    index("endpoint_forward_deliveries_request_id_idx").on(table.requestId),
    index("endpoint_forward_deliveries_status_idx").on(table.status),
    check(
      "endpoint_forward_deliveries_status_check",
      sql`${table.status} in ('pending', 'delivered', 'failed', 'cancelled')`
    ),
    check(
      "endpoint_forward_deliveries_target_path_mode_check",
      sql`${table.targetPathMode} in ('strip', 'preserve')`
    ),
    check(
      "endpoint_forward_deliveries_attempts_check",
      sql`${table.attempts} >= 0`
    ),
  ]
)

export type CapturedRequestRow = typeof capturedRequests.$inferSelect
export type EndpointResponseRow = typeof endpointResponses.$inferSelect
export type EndpointForwardTargetRow =
  typeof endpointForwardTargets.$inferSelect
export type EndpointForwardDeliveryRow =
  typeof endpointForwardDeliveries.$inferSelect
