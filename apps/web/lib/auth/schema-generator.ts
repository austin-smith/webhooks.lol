import { betterAuth } from "better-auth/minimal"
import { drizzle } from "drizzle-orm/postgres-js"
import { loadEnvConfig } from "@next/env"
import postgres from "postgres"

import * as schema from "@webhooks-lol/database/schema"
import { createAuthOptions } from "./options"

loadEnvConfig(process.cwd())

const client = postgres(readDatabaseUrl(), {
  prepare: false,
})

export const auth = betterAuth(createAuthOptions(drizzle(client, { schema })))

function readDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required to run Better Auth schema generation."
    )
  }

  return databaseUrl
}
