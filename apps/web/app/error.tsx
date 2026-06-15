"use client"

import { RotateCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function Error({
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4 font-mono text-xs">
      <section className="w-full max-w-xl rounded-md border bg-card p-4">
        <div className="border-b pb-3">
          <p className="text-[0.68rem] text-muted-foreground">WEBHOOKS.LOL</p>
          <h1 className="text-sm font-medium">ERROR</h1>
        </div>
        <div className="flex flex-col gap-4 pt-4">
          <p className="text-muted-foreground">
            The inspector failed to render.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-fit rounded-md"
            onClick={unstable_retry}
          >
            <RotateCwIcon data-icon="inline-start" />
            Retry
          </Button>
        </div>
      </section>
    </main>
  )
}
