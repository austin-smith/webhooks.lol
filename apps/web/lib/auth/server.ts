import { betterAuth } from "better-auth/minimal"
import { nextCookies } from "better-auth/next-js"

import { createAuthOptions } from "@/lib/auth/options"
import { getDatabase } from "@webhooks-lol/database/client"

type ServerAuth = ReturnType<typeof createAuth>

let auth: ServerAuth | undefined

export function getAuth() {
  auth ??= createAuth()
  return auth
}

function createAuth() {
  const authOptions = createAuthOptions(getDatabase())

  return betterAuth({
    ...authOptions,
    plugins: [...authOptions.plugins, nextCookies()],
  })
}

export type AuthSession = Awaited<ReturnType<ServerAuth["api"]["getSession"]>>
