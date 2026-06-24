import type { Metadata } from "next"
import Link from "next/link"

import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { Button } from "@/components/ui/button"
import {
  createAuthRedirectHref,
  resolveAuthRedirectPath,
} from "@/lib/auth/redirects"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Email verified | webhooks.lol",
}

type EmailVerifiedPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function EmailVerifiedPage({
  searchParams,
}: EmailVerifiedPageProps) {
  const resolvedSearchParams = await searchParams
  const error = readSearchParam(resolvedSearchParams.error)
  const callbackPath = resolveAuthRedirectPath(resolvedSearchParams.next)
  const isError = Boolean(error)

  return (
    <AuthPageShell
      eyebrow="ACCOUNT"
      title={isError ? "Verification link expired" : "Email verified"}
    >
      <div className="space-y-4">
        {isError ? (
          <p className="text-center text-[0.68rem] leading-relaxed text-muted-foreground">
            The verification link is invalid or expired.
          </p>
        ) : null}
        <Button asChild className="w-full rounded-sm text-xs">
          <Link href={createAuthRedirectHref("/login", callbackPath)}>
            Sign in
          </Link>
        </Button>
      </div>
    </AuthPageShell>
  )
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
