import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4 font-mono text-xs">
      <section className="w-full max-w-xl rounded-md border bg-card p-4">
        <div className="border-b pb-3">
          <p className="text-[0.68rem] text-muted-foreground">WEBHOOKS.LOL</p>
          <h1 className="text-sm font-medium">404</h1>
        </div>
        <div className="pt-4">
          <Button asChild variant="outline" className="w-fit rounded-md">
            <Link href="/">
              <ArrowLeftIcon data-icon="inline-start" />
              Return
            </Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
