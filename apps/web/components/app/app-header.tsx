import Image from "next/image"
import Link from "next/link"
import type { ComponentType, SVGProps } from "react"
import { BookTextIcon } from "lucide-react"

import { AppAuthLink } from "@/components/auth/app-auth-link"
import { GithubIcon } from "@/components/icons/github-icon"
import { ThemeSwitcher } from "@/components/theme/theme-switcher"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AppHeaderMenu } from "./app-header-menu"

const GITHUB_URL = "https://github.com/austin-smith/webhooks.lol"

export type AppHeaderUser = {
  email: string
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
        <nav
          aria-label="Resources"
          className="hidden shrink-0 items-center gap-0.5 sm:flex"
        >
          {docsUrl ? (
            <AppHeaderLink href={docsUrl} icon={BookTextIcon} label="DOCS" />
          ) : null}
          <AppHeaderLink href={GITHUB_URL} icon={GithubIcon} label="GITHUB" />
          <ThemeSwitcher />
          <AppAuthLink user={user} />
        </nav>
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
  const link = (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[0.68rem] font-medium tracking-wide text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:hover:bg-muted/50"
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </a>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent className="sm:hidden">{label}</TooltipContent>
    </Tooltip>
  )
}
