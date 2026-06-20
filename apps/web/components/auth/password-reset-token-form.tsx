"use client"

import * as React from "react"
import Link from "next/link"

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
  type PasswordResetTokenField,
  type PasswordResetTokenFieldErrors,
  validatePasswordResetTokenInput,
} from "@/lib/auth/password-reset-validation"

type PasswordResetTokenFormProps = {
  callbackPath: string
  token: string
}

export function PasswordResetTokenForm({
  callbackPath,
  token,
}: PasswordResetTokenFormProps) {
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmedPassword, setConfirmedPassword] = React.useState("")
  const [fieldErrors, setFieldErrors] =
    React.useState<PasswordResetTokenFieldErrors>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isComplete, setIsComplete] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const validationErrors = validatePasswordResetTokenInput({
      confirmedPassword,
      newPassword,
    })

    setFieldErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      const result = await authClient.resetPassword({
        newPassword,
        token,
      })

      if (result.error) {
        setFormError("This reset link is invalid or expired.")
        return
      }

      setNewPassword("")
      setConfirmedPassword("")
      setFieldErrors({})
      setIsComplete(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  function updateField(
    field: PasswordResetTokenField,
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

  if (isComplete) {
    return (
      <div className="flex flex-col gap-3" role="status">
        <p className="text-center text-[0.68rem] leading-relaxed text-muted-foreground">
          Password reset.
        </p>
        <Button asChild className="w-full rounded-sm text-xs">
          <Link href={createLoginHref(callbackPath)}>Sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={resetPassword} noValidate>
      <FieldGroup className="gap-3">
        <Field
          data-disabled={isSubmitting || undefined}
          data-invalid={Boolean(fieldErrors.newPassword)}
        >
          <FieldLabel
            htmlFor="reset-password-new-password"
            className="text-[0.68rem] tracking-wide text-muted-foreground"
          >
            NEW PASSWORD
          </FieldLabel>
          <Input
            id="reset-password-new-password"
            aria-describedby={
              fieldErrors.newPassword
                ? "reset-password-new-password-error"
                : undefined
            }
            aria-invalid={Boolean(fieldErrors.newPassword)}
            autoComplete="new-password"
            disabled={isSubmitting}
            onChange={(event) =>
              updateField("newPassword", event.target.value, setNewPassword)
            }
            type="password"
            value={newPassword}
          />
          <FieldError id="reset-password-new-password-error">
            {fieldErrors.newPassword}
          </FieldError>
        </Field>
        <Field
          data-disabled={isSubmitting || undefined}
          data-invalid={Boolean(fieldErrors.confirmedPassword)}
        >
          <FieldLabel
            htmlFor="reset-password-confirmed-password"
            className="text-[0.68rem] tracking-wide text-muted-foreground"
          >
            CONFIRM NEW PASSWORD
          </FieldLabel>
          <Input
            id="reset-password-confirmed-password"
            aria-describedby={
              fieldErrors.confirmedPassword
                ? "reset-password-confirmed-password-error"
                : undefined
            }
            aria-invalid={Boolean(fieldErrors.confirmedPassword)}
            autoComplete="new-password"
            disabled={isSubmitting}
            onChange={(event) =>
              updateField(
                "confirmedPassword",
                event.target.value,
                setConfirmedPassword
              )
            }
            type="password"
            value={confirmedPassword}
          />
          <FieldError id="reset-password-confirmed-password-error">
            {fieldErrors.confirmedPassword}
          </FieldError>
        </Field>
        {formError ? (
          <FieldError className="text-left">{formError}</FieldError>
        ) : null}
      </FieldGroup>
      <Button
        type="submit"
        className="w-full rounded-sm text-xs"
        disabled={isSubmitting}
      >
        Reset password
      </Button>
    </form>
  )
}

function createLoginHref(callbackPath: string) {
  if (callbackPath === "/") {
    return "/login"
  }

  return `/login?next=${encodeURIComponent(callbackPath)}`
}
