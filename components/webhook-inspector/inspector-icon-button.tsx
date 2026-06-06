"use client"

import { type LucideIcon } from "lucide-react"
import type { ComponentProps } from "react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function InspectorIconButton({
  className,
  disabled,
  icon: Icon,
  label,
  onClick,
  size = "icon",
  variant = "outline",
}: {
  className?: string
  disabled?: boolean
  icon: LucideIcon
  label: string
  onClick?: () => void
  size?: ComponentProps<typeof Button>["size"]
  variant?: ComponentProps<typeof Button>["variant"]
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={cn("rounded-md", className)}
          disabled={disabled}
          onClick={onClick}
        >
          <Icon data-icon="inline-start" />
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
