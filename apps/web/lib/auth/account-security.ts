import "server-only"

import { headers } from "next/headers"

import { getAuth } from "./server"

type AuthAccount = {
  providerId: string
}

export type AccountSecurity = {
  canResetPassword: boolean
  signInMethodLabel: string
}

export async function getCurrentAccountSecurity() {
  const accounts = await getAuth().api.listUserAccounts({
    headers: await headers(),
  })

  return resolveAccountSecurity(accounts)
}

export function resolveAccountSecurity(
  accounts: readonly AuthAccount[]
): AccountSecurity {
  const hasCredentialAccount = accounts.some(
    (account) => account.providerId === "credential"
  )

  if (hasCredentialAccount) {
    return {
      canResetPassword: true,
      signInMethodLabel: "Email and password",
    }
  }

  const hasGitHubAccount = accounts.some(
    (account) => account.providerId === "github"
  )

  return {
    canResetPassword: false,
    signInMethodLabel: hasGitHubAccount ? "GitHub" : "External provider",
  }
}
