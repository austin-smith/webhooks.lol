import Image from "next/image"
import Link from "next/link"
import type { ComponentType, SVGProps } from "react"
import { BookTextIcon } from "lucide-react"

import { AppAuthLink } from "@/components/auth/app-auth-link"
import { GithubIcon } from "@/components/icons/github-icon"
import { ThemeSwitcher } from "@/components/theme/theme-switcher"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AppHeaderMenu } from "./app-header-menu"

const GITHUB_URL = "https://github.com/austin-smith/webhooks.lol"

export type AppHeaderUser = {
  email: string
  image: string | null
  name: string
}

type AppHeaderProps = {
  docsUrl: string | null
  user: AppHeaderUser | null
}

export function AppHeader({ docsUrl, user }: AppHeaderProps) {
  return (
    <header className="shrink-0 border-b bg-background px-4 py-3 lg:px-5">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 text-foreground transition-colors hover:text-foreground/80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-label="webhooks.lol home"
        >
          <span className="flex size-5 shrink-0 items-center justify-center">
            <Image
              src="/icon.png"
              alt=""
              width={20}
              height={20}
              aria-hidden="true"
              className="size-5"
              priority
            />
          </span>
          <span className="truncate font-heading text-sm font-semibold tracking-tight">
            WEBHOOKS<span className="text-brand">.LOL</span>
          </span>
        </Link>
        <div className="hidden shrink-0 items-center gap-2 text-muted-foreground sm:flex">
          <nav aria-label="Resources" className="flex items-center gap-0.5">
            {docsUrl ? (
              <AppHeaderLink href={docsUrl} icon={BookTextIcon} label="DOCS" />
            ) : null}
            <AppHeaderLink href={GITHUB_URL} icon={GithubIcon} label="GITHUB" />
          </nav>
          <Separator
            orientation="vertical"
            className="data-vertical:h-4 data-vertical:self-center"
          />
          <div
            role="group"
            aria-label="Account and preferences"
            className="flex items-center gap-0.5"
          >
            <AppAuthLink user={user} />
            {user ? null : <ThemeSwitcher trigger="preferences" />}
          </div>
        </div>
        <nav
          aria-label="App menu"
          className="flex shrink-0 items-center sm:hidden"
        >
          <AppHeaderMenu docsUrl={docsUrl} user={user} />
        </nav>
      </div>
    </header>
  )
}

function AppHeaderLink({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
}) {
  return (
    <Button asChild variant="ghost" size="xs">
      <a href={href} target="_blank" rel="noopener noreferrer">
        <Icon data-icon="inline-start" aria-hidden="true" />
        {label}
      </a>
    </Button>
  )
}
