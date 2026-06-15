import { APIError } from "better-auth/api"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin } from "better-auth/plugins/admin"

import * as schema from "@webhooks-lol/database/schema"
import { enforceClosedSignupPolicy } from "./signup-policy"
import type { DrizzleDatabase } from "./types"

export function createAuthOptions(database: DrizzleDatabase) {
  return {
    appName: "webhooks.lol",
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
      transaction: true,
    }),
    databaseHooks: {
      user: {
        create: {
          async before(newUser: Record<string, unknown>) {
            if (await enforceClosedSignupPolicy(database)) {
              return {
                data: {
                  ...newUser,
                  role: "admin",
                },
              }
            }

            throw APIError.from("FORBIDDEN", {
              code: "SIGNUP_CLOSED",
              message: "Signup is closed for this deployment.",
            })
          },
        },
      },
    },
    plugins: [admin()],
    socialProviders: {
      github: {
        clientId: readRequiredEnv("GITHUB_CLIENT_ID"),
        clientSecret: readRequiredEnv("GITHUB_CLIENT_SECRET"),
        scope: ["user:email"],
      },
    },
    account: {
      accountLinking: {
        enabled: false,
      },
      encryptOAuthTokens: true,
      storeStateStrategy: "database" as const,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      storeSessionInDatabase: true,
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
    },
  }
}

function readRequiredEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required to use GitHub authentication.`)
  }

  return value
}
