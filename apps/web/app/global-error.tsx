"use client"

import { RotateCwIcon } from "lucide-react"

import "./globals.css"
import { Button } from "@/components/ui/button"

export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="en" className="font-mono antialiased">
      <body>
        <main className="flex min-h-svh items-center justify-center bg-background p-4 font-mono text-xs">
          <title>webhooks.lol Error</title>
          <section className="w-full max-w-xl rounded-md border bg-card p-4">
            <div className="border-b pb-3">
              <p className="text-[0.68rem] text-muted-foreground">
                WEBHOOKS.LOL
              </p>
              <h1 className="text-sm font-medium">ERROR</h1>
            </div>
            <div className="flex flex-col gap-4 pt-4">
              <p className="text-muted-foreground">The app failed to render.</p>
              <Button
                type="button"
                variant="outline"
                className="w-fit rounded-md"
                onClick={retry}
              >
                <RotateCwIcon data-icon="inline-start" />
                Retry
              </Button>
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
