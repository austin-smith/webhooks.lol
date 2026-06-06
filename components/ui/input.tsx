import * as React from "react"

import { cn } from "@/lib/utils"

type InputVariant = "default" | "embedded"
type InputDensity = "default" | "compact"

function Input({
  className,
  density = "default",
  type,
  variant = "default",
  ...props
}: React.ComponentProps<"input"> & {
  density?: InputDensity
  variant?: InputVariant
}) {
  return (
    <input
      type={type}
      data-slot="input"
      data-variant={variant}
      className={cn(
        "w-full min-w-0 rounded-lg border bg-transparent transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        density === "default" && "h-8 px-2.5 py-1 text-base md:text-sm",
        density === "compact" && "h-7 px-2 py-1 text-xs md:text-xs",
        variant === "default" &&
          "border-input focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
        variant === "embedded" &&
          "border-transparent shadow-none focus-visible:border-transparent focus-visible:ring-0 disabled:bg-transparent dark:bg-transparent dark:disabled:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

export { Input }
