import Link from "next/link"

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <p className="text-fd-muted-foreground text-sm font-medium">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        Documentation page not found
      </h1>
      <p className="text-fd-muted-foreground">
        The page may have moved, or the URL may be incomplete.
      </p>
      <Link
        href="/"
        className="hover:bg-fd-accent w-fit rounded-md border px-3 py-2 text-sm font-medium transition-colors"
      >
        Back to docs
      </Link>
    </main>
  )
}
