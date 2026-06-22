import Link from "next/link"
import { LogInIcon } from "lucide-react"

import { appHeaderActionClassName } from "@/components/app/app-header-action"
import type { AppHeaderUser } from "@/components/app/app-header"
import { AppAccountMenu } from "./app-account-menu"

export function AppAuthLink({ user }: { user: AppHeaderUser | null }) {
  if (user) {
    return <AppAccountMenu user={user} />
  }

  return (
    <Link href="/login" className={appHeaderActionClassName}>
      <LogInIcon className="size-3.5" aria-hidden="true" />
      LOGIN
    </Link>
  )
}
