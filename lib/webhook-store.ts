import "server-only"

import Database from "better-sqlite3"
import { mkdirSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import type { CapturedRequest } from "@/lib/webhook-types"

const MAX_REQUESTS_PER_INBOX = 500
const DATABASE_PATH = path.join(
  os.homedir(),
  ".webhooks-lol",
  "webhooks.sqlite"
)

type DatabaseConnection = Database.Database

type CapturedRequestInput = Omit<CapturedRequest, "id" | "receivedAt">

type RequestRow = {
  id: string
  token: string
  method: string
  url: string
  path: string
  query_json: string
  headers_json: string
  body_text: string
  body_base64: string
  body_size: number
  content_type: string | null
  received_at: string
  ip: string | null
}

const globalForDb = globalThis as typeof globalThis & {
  __webhooksLolDb?: DatabaseConnection
}

function getDb() {
  if (globalForDb.__webhooksLolDb) {
    return globalForDb.__webhooksLolDb
  }

  mkdirSync(path.dirname(DATABASE_PATH), { recursive: true })

  const db = new Database(DATABASE_PATH)
  db.pragma("journal_mode = WAL")
  db.pragma("foreign_keys = ON")

  db.exec(`
    create table if not exists inboxes (
      token text primary key,
      created_at text not null
    );

    create table if not exists requests (
      id text primary key,
      token text not null references inboxes(token) on delete cascade,
      method text not null,
      url text not null,
      path text not null,
      query_json text not null,
      headers_json text not null,
      body_text text not null,
      body_base64 text not null,
      body_size integer not null,
      content_type text,
      received_at text not null,
      ip text
    );

    create index if not exists requests_token_received_at_idx
      on requests(token, received_at desc);
  `)

  globalForDb.__webhooksLolDb = db
  return db
}

export function createInbox() {
  const token = crypto.randomUUID()
  ensureInbox(token)
  return token
}

export function ensureInbox(token: string) {
  getDb()
    .prepare(
      "insert or ignore into inboxes (token, created_at) values (@token, @createdAt)"
    )
    .run({
      token,
      createdAt: new Date().toISOString(),
    })
}

export function saveCapturedRequest(input: CapturedRequestInput) {
  ensureInbox(input.token)

  const request: CapturedRequest = {
    ...input,
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
  }

  const db = getDb()
  const insert = db.prepare(`
    insert into requests (
      id,
      token,
      method,
      url,
      path,
      query_json,
      headers_json,
      body_text,
      body_base64,
      body_size,
      content_type,
      received_at,
      ip
    ) values (
      @id,
      @token,
      @method,
      @url,
      @path,
      @queryJson,
      @headersJson,
      @bodyText,
      @bodyBase64,
      @bodySize,
      @contentType,
      @receivedAt,
      @ip
    )
  `)

  const prune = db.prepare(`
    delete from requests
    where token = @token
      and id not in (
        select id
        from requests
        where token = @token
        order by received_at desc
        limit @limit
      )
  `)

  db.transaction(() => {
    insert.run({
      id: request.id,
      token: request.token,
      method: request.method,
      url: request.url,
      path: request.path,
      queryJson: JSON.stringify(request.query),
      headersJson: JSON.stringify(request.headers),
      bodyText: request.bodyText,
      bodyBase64: request.bodyBase64,
      bodySize: request.bodySize,
      contentType: request.contentType,
      receivedAt: request.receivedAt,
      ip: request.ip,
    })
    prune.run({ token: request.token, limit: MAX_REQUESTS_PER_INBOX })
  })()

  return request
}

export function listRequests(token: string) {
  ensureInbox(token)

  return getDb()
    .prepare(
      `select *
       from requests
       where token = ?
       order by received_at desc
       limit ?`
    )
    .all(token, MAX_REQUESTS_PER_INBOX)
    .map(mapRequestRow)
}

export function clearRequests(token: string) {
  ensureInbox(token)
  getDb().prepare("delete from requests where token = ?").run(token)
}

function mapRequestRow(row: unknown): CapturedRequest {
  const request = row as RequestRow

  return {
    id: request.id,
    token: request.token,
    method: request.method,
    url: request.url,
    path: request.path,
    query: JSON.parse(request.query_json) as Record<string, string[]>,
    headers: JSON.parse(request.headers_json) as Record<string, string>,
    bodyText: request.body_text,
    bodyBase64: request.body_base64,
    bodySize: request.body_size,
    contentType: request.content_type,
    receivedAt: request.received_at,
    ip: request.ip,
  }
}
