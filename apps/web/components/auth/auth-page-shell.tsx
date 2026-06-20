import Link from "next/link"
import type React from "react"
import { ArrowLeftIcon } from "lucide-react"

import { ThemeSwitcher } from "@/components/theme/theme-switcher"

type AuthPageShellProps = {
  children: React.ReactNode
  backHref?: string
  backLabel?: string
  eyebrow: string
  title: string
}

export function AuthPageShell({
  backHref,
  backLabel,
  children,
  eyebrow,
  title,
}: AuthPageShellProps) {
  return (
    <main className="flex min-h-svh bg-background p-4 font-mono text-xs text-foreground sm:p-6">
      <section className="mx-auto flex w-full max-w-sm flex-col justify-center gap-5">
        {backHref && backLabel ? (
          <Link
            href={backHref}
            className="inline-flex w-fit items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5" />
            {backLabel}
          </Link>
        ) : null}
        <header className="flex items-center justify-between border-b pb-4">
          <Link
            href="/"
            className="font-heading text-sm font-semibold tracking-tight text-foreground"
          >
            WEBHOOKS<span className="text-brand">.LOL</span>
          </Link>
          <ThemeSwitcher />
        </header>
        <div className="space-y-2">
          <p className="font-mono text-[0.68rem] tracking-wide text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="font-heading text-lg">{title}</h1>
        </div>
        {children}
      </section>
    </main>
  )
}
