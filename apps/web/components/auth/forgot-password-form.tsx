"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth/client"
import {
  type ForgotPasswordField,
  type ForgotPasswordFieldErrors,
  validateForgotPasswordInput,
} from "@/lib/auth/password-reset-validation"
import { RESET_PASSWORD_PATH } from "@/lib/auth/redirects"
import { TurnstileField, type TurnstileFieldHandle } from "./turnstile-field"

const PASSWORD_RESET_REQUESTED_MESSAGE =
  "If a password reset is available for that email, a reset link will be sent."

type ForgotPasswordFormProps = {
  callbackPath: string
}

export function ForgotPasswordForm({ callbackPath }: ForgotPasswordFormProps) {
  const turnstileRef = React.useRef<TurnstileFieldHandle>(null)
  const [email, setEmail] = React.useState("")
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(
    null
  )
  const [fieldErrors, setFieldErrors] =
    React.useState<ForgotPasswordFieldErrors>({})
  const [message, setMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  async function requestPasswordReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    const emailAddress = email.trim()
    const validationErrors = validateForgotPasswordInput({
      email: emailAddress,
    })

    setFieldErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    if (!turnstileToken) {
      setMessage("Complete the security check.")
      return
    }

    setIsSubmitting(true)

    try {
      const result = await authClient.requestPasswordReset({
        email: emailAddress,
        fetchOptions: {
          headers: {
            "x-captcha-response": turnstileToken,
          },
        },
        redirectTo: createResetPasswordHref(callbackPath),
      })

      if (result.error) {
        setMessage("Could not request password reset.")
        return
      }

      setEmail("")
      setFieldErrors({})
      setMessage(PASSWORD_RESET_REQUESTED_MESSAGE)
    } finally {
      turnstileRef.current?.reset()
      setIsSubmitting(false)
    }
  }

  function updateField(
    field: ForgotPasswordField,
    value: string,
    setValue: (value: string) => void
  ) {
    setValue(value)
    setFieldErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors
      }

      const remainingErrors = { ...currentErrors }
      delete remainingErrors[field]
      return remainingErrors
    })
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={requestPasswordReset}
      noValidate
    >
      <FieldGroup className="gap-3">
        <Field
          data-disabled={isSubmitting || undefined}
          data-invalid={Boolean(fieldErrors.email)}
        >
          <FieldLabel
            htmlFor="forgot-password-email"
            className="text-[0.68rem] tracking-wide text-muted-foreground"
          >
            EMAIL
          </FieldLabel>
          <Input
            id="forgot-password-email"
            aria-describedby={
              fieldErrors.email ? "forgot-password-email-error" : undefined
            }
            aria-invalid={Boolean(fieldErrors.email)}
            autoComplete="email"
            disabled={isSubmitting}
            onChange={(event) =>
              updateField("email", event.target.value, setEmail)
            }
            type="email"
            value={email}
          />
          <FieldError id="forgot-password-email-error">
            {fieldErrors.email}
          </FieldError>
        </Field>
      </FieldGroup>
      <TurnstileField
        ref={turnstileRef}
        disabled={isSubmitting}
        onTokenChange={setTurnstileToken}
      />
      <Button
        type="submit"
        className="w-full rounded-sm text-xs"
        disabled={isSubmitting || !turnstileToken}
      >
        Send reset link
      </Button>
      {message ? (
        <p
          className="text-center text-[0.68rem] leading-relaxed text-muted-foreground"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </form>
  )
}

function createResetPasswordHref(callbackPath: string) {
  if (callbackPath === "/") {
    return RESET_PASSWORD_PATH
  }

  return `${RESET_PASSWORD_PATH}?next=${encodeURIComponent(callbackPath)}`
}
