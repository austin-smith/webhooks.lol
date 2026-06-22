import "server-only"

import { headers } from "next/headers"

import { getAdminRole } from "@/lib/auth/authorization"
import { getAuth, type AuthSession } from "@/lib/auth/server"

export type CurrentSession = NonNullable<AuthSession>

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required.")
    this.name = "AuthenticationRequiredError"
  }
}

export class AuthorizationRequiredError extends Error {
  constructor() {
    super("You do not have permission to access this resource.")
    this.name = "AuthorizationRequiredError"
  }
}

export async function getCurrentSession() {
  const requestHeaders = await headers()

  return getAuth().api.getSession({
    headers: requestHeaders,
  })
}

export async function requireUserSession() {
  const session = await getCurrentSession()

  if (!session) {
    throw new AuthenticationRequiredError()
  }

  return session
}

export async function requireAdminSession() {
  const requestHeaders = await headers()
  const session = await getAuth().api.getSession({
    headers: requestHeaders,
  })

  if (!session) {
    throw new AuthenticationRequiredError()
  }

  const role = await getAdminRole(session.user.id)

  if (!role) {
    throw new AuthorizationRequiredError()
  }

  return { ...session, role }
}
