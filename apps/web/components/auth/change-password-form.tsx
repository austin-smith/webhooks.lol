"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth/client"
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/password-policy"

type ChangePasswordField =
  | "confirmedPassword"
  | "currentPassword"
  | "newPassword"

type ChangePasswordFieldErrors = Partial<Record<ChangePasswordField, string>>

export function ChangePasswordForm() {
  const router = useRouter()
  const [isOpen, setIsOpen] = React.useState(false)
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmedPassword, setConfirmedPassword] = React.useState("")
  const [fieldErrors, setFieldErrors] =
    React.useState<ChangePasswordFieldErrors>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const validationErrors = validateChangePasswordInput({
      confirmedPassword,
      currentPassword,
      newPassword,
    })

    setFieldErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })

      if (result.error) {
        if (isInvalidCurrentPasswordError(result.error)) {
          setFieldErrors({
            currentPassword: "Current password is incorrect.",
          })
          return
        }

        setFormError(result.error.message ?? "Could not change password.")
        return
      }

      setCurrentPassword("")
      setNewPassword("")
      setConfirmedPassword("")
      setIsOpen(false)
      setFieldErrors({})
      setFormError(null)
      setStatusMessage("Password changed.")
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  function validateChangePasswordInput({
    confirmedPassword,
    currentPassword,
    newPassword,
  }: {
    confirmedPassword: string
    currentPassword: string
    newPassword: string
  }): ChangePasswordFieldErrors {
    const errors: ChangePasswordFieldErrors = {}

    if (!currentPassword) {
      errors.currentPassword = "Current password is required."
    }

    if (!newPassword) {
      errors.newPassword = "New password is required."
    } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
      errors.newPassword = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    } else if (newPassword.length > MAX_PASSWORD_LENGTH) {
      errors.newPassword = "Password is too long."
    }

    if (!confirmedPassword) {
      errors.confirmedPassword = "Confirm your new password."
    } else if (newPassword && newPassword !== confirmedPassword) {
      errors.confirmedPassword = "Passwords do not match."
    }

    return errors
  }

  function closeDialog() {
    if (isSubmitting) {
      return
    }

    clearPasswordFields()
    setFieldErrors({})
    setFormError(null)
    setIsOpen(false)
  }

  function clearPasswordFields() {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmedPassword("")
  }

  function setDialogOpen(open: boolean) {
    if (open) {
      setStatusMessage(null)
      setFormError(null)
      setFieldErrors({})
      setIsOpen(true)
      return
    }

    closeDialog()
  }

  function updateField(
    field: ChangePasswordField,
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
    <div className="flex flex-col gap-3 rounded-md border bg-card p-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-sm">Password</h2>
        {statusMessage ? (
          <p className="text-[0.68rem] text-muted-foreground" role="status">
            {statusMessage}
          </p>
        ) : null}
      </div>
      <Dialog open={isOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full rounded-sm text-xs"
            onClick={() => setStatusMessage(null)}
          >
            Change password
          </Button>
        </DialogTrigger>
        <DialogContent aria-describedby={undefined} className="sm:max-w-xs">
          <form
            className="flex flex-col gap-4"
            onSubmit={changePassword}
            noValidate
          >
            <DialogHeader>
              <DialogTitle>Change password</DialogTitle>
            </DialogHeader>
            <FieldGroup className="gap-3">
              <Field
                data-disabled={isSubmitting || undefined}
                data-invalid={Boolean(fieldErrors.currentPassword)}
              >
                <FieldLabel
                  htmlFor="current-password"
                  className="text-[0.68rem] tracking-wide text-muted-foreground"
                >
                  CURRENT PASSWORD
                </FieldLabel>
                <Input
                  id="current-password"
                  aria-describedby={
                    fieldErrors.currentPassword
                      ? "current-password-error"
                      : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.currentPassword)}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  onChange={(event) =>
                    updateField(
                      "currentPassword",
                      event.target.value,
                      setCurrentPassword
                    )
                  }
                  type="password"
                  value={currentPassword}
                />
                <FieldError id="current-password-error">
                  {fieldErrors.currentPassword}
                </FieldError>
              </Field>
              <FieldSeparator />
              <Field
                data-disabled={isSubmitting || undefined}
                data-invalid={Boolean(fieldErrors.newPassword)}
              >
                <FieldLabel
                  htmlFor="new-password"
                  className="text-[0.68rem] tracking-wide text-muted-foreground"
                >
                  NEW PASSWORD
                </FieldLabel>
                <Input
                  id="new-password"
                  aria-describedby={
                    fieldErrors.newPassword ? "new-password-error" : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.newPassword)}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  onChange={(event) =>
                    updateField(
                      "newPassword",
                      event.target.value,
                      setNewPassword
                    )
                  }
                  type="password"
                  value={newPassword}
                />
                <FieldError id="new-password-error">
                  {fieldErrors.newPassword}
                </FieldError>
              </Field>
              <Field
                data-disabled={isSubmitting || undefined}
                data-invalid={Boolean(fieldErrors.confirmedPassword)}
              >
                <FieldLabel
                  htmlFor="confirmed-password"
                  className="text-[0.68rem] tracking-wide text-muted-foreground"
                >
                  CONFIRM NEW PASSWORD
                </FieldLabel>
                <Input
                  id="confirmed-password"
                  aria-describedby={
                    fieldErrors.confirmedPassword
                      ? "confirmed-password-error"
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
                <FieldError id="confirmed-password-error">
                  {fieldErrors.confirmedPassword}
                </FieldError>
              </Field>
              {formError ? (
                <FieldError className="text-left">{formError}</FieldError>
              ) : null}
            </FieldGroup>
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={closeDialog}
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                Change password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function isInvalidCurrentPasswordError(error: {
  code?: string
  message?: string
}) {
  return (
    error.code === "INVALID_PASSWORD" ||
    error.message === "Invalid password" ||
    error.message === "Invalid Password"
  )
}
