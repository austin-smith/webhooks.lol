import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

export const inboxes = pgTable("inboxes", {
  token: text("token").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const capturedRequests = pgTable(
  "requests",
  {
    id: uuid("id").primaryKey(),
    token: text("token")
      .notNull()
      .references(() => inboxes.token, { onDelete: "cascade" }),
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
    index("requests_token_received_at_idx").on(table.token, table.receivedAt),
  ]
)

export type CapturedRequestRow = typeof capturedRequests.$inferSelect
