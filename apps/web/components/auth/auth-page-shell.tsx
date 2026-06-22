import Link from "next/link"
import type React from "react"
import { ArrowLeftIcon } from "lucide-react"

import { AppShell } from "@/components/app/app-shell"
import { readDocsUrl } from "@/lib/app-urls"

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
    <AppShell docsUrl={readDocsUrl()} user={null}>
      <main className="flex flex-1 bg-background p-4 sm:p-6">
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
          <div className="flex flex-col gap-2 border-b pb-4">
            <p className="font-mono text-[0.68rem] tracking-wide text-muted-foreground">
              {eyebrow}
            </p>
            <h1 className="font-heading text-lg">{title}</h1>
          </div>
          {children}
        </section>
      </main>
    </AppShell>
  )
}
