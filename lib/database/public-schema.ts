import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const endpoints = pgTable("endpoints", {
  id: uuid("id").primaryKey(),
  name: text("name"),
  creatorKeyHash: text("creator_key_hash"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

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
  },
  (table) => [
    index("requests_endpoint_id_received_at_idx").on(
      table.endpointId,
      table.receivedAt
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

export type CapturedRequestRow = typeof capturedRequests.$inferSelect
export type EndpointResponseRow = typeof endpointResponses.$inferSelect
