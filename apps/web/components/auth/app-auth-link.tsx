import Link from "next/link"

import type { AppHeaderUser } from "@/components/app/app-header"
import { AppAccountMenu } from "./app-account-menu"

const authHeaderLinkClassName =
  "inline-flex h-7 items-center rounded-md px-2 text-[0.68rem] font-medium tracking-wide text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:hover:bg-muted/50"

export function AppAuthLink({ user }: { user: AppHeaderUser | null }) {
  if (user) {
    return <AppAccountMenu user={user} />
  }

  return (
    <Link href="/login" className={authHeaderLinkClassName}>
      SIGN IN
    </Link>
  )
}
