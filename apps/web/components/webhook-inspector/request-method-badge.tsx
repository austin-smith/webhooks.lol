import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const methodClassNames: Partial<Record<string, string>> = {
  DELETE:
    "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-300",
  GET: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-300",
  HEAD: "border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:border-indigo-400/25 dark:bg-indigo-400/10 dark:text-indigo-300",
  OPTIONS:
    "border-cyan-500/20 bg-cyan-500/10 text-cyan-800 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300",
  PATCH:
    "border-teal-500/20 bg-teal-500/10 text-teal-700 dark:border-teal-400/25 dark:bg-teal-400/10 dark:text-teal-300",
  POST: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300",
  PUT: "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300",
}

export function RequestMethodBadge({
  className,
  method,
}: {
  className?: string
  method: string
}) {
  const methodClassName = methodClassNames[method.trim().toUpperCase()]

  return (
    <Badge
      variant="outline"
      className={cn(
        "min-w-10 px-1.5 font-semibold",
        methodClassName,
        className
      )}
    >
      {method}
    </Badge>
  )
}
