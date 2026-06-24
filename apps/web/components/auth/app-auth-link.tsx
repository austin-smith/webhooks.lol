import Link from "next/link"
import { LogInIcon } from "lucide-react"

import type { AppHeaderUser } from "@/components/app/app-header"
import { Button } from "@/components/ui/button"
import { AppAccountMenu } from "./app-account-menu"

export function AppAuthLink({ user }: { user: AppHeaderUser | null }) {
  if (user) {
    return <AppAccountMenu user={user} />
  }

  return (
    <Button asChild variant="ghost" size="xs">
      <Link href="/login">
        <LogInIcon data-icon="inline-start" aria-hidden="true" />
        LOGIN
      </Link>
    </Button>
  )
}
