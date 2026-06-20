import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  type LucideIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

export type AuthFormFeedbackTone = "error" | "info" | "success"

export type AuthFormFeedbackState = {
  description?: string
  title: string
  tone: AuthFormFeedbackTone
}

const feedbackIcons: Record<AuthFormFeedbackTone, LucideIcon> = {
  error: CircleAlertIcon,
  info: InfoIcon,
  success: CircleCheckIcon,
}

export function AuthFormFeedback({
  description,
  title,
  tone,
}: AuthFormFeedbackState) {
  const Icon = feedbackIcons[tone]
  const isError = tone === "error"

  return (
    <Alert
      role={isError ? "alert" : "status"}
      variant={isError ? "destructive" : "default"}
    >
      <Icon
        aria-hidden="true"
        className={cn(tone === "success" && "text-status-live")}
      />
      <AlertTitle>{title}</AlertTitle>
      {description ? <AlertDescription>{description}</AlertDescription> : null}
    </Alert>
  )
}
