import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres, { type Sql } from "postgres"

import * as schema from "@/lib/database/schema"

type DatabaseConnection = {
  client: Sql
  db: PostgresJsDatabase<typeof schema>
}

const globalForDatabase = globalThis as typeof globalThis & {
  __webhooksLolDatabase?: DatabaseConnection
}

export function getDatabase() {
  return getDatabaseConnection().db
}

function getDatabaseConnection() {
  if (globalForDatabase.__webhooksLolDatabase) {
    return globalForDatabase.__webhooksLolDatabase
  }

  const client = postgres(readDatabaseUrl(), {
    prepare: false,
  })

  const connection = {
    client,
    db: drizzle(client, { schema }),
  }

  globalForDatabase.__webhooksLolDatabase = connection
  return connection
}

function readDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to connect to PostgreSQL.")
  }

  return databaseUrl
}
