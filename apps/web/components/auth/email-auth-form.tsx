"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

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
  type EmailAuthField,
  type EmailAuthFieldErrors,
  validateEmailAuthInput,
} from "@/lib/auth/email-auth-validation"
import {
  EMAIL_VERIFICATION_CALLBACK_PATH,
  FORGOT_PASSWORD_PATH,
} from "@/lib/auth/redirects"

type EmailAuthMode = "login" | "sign-up"

type EmailAuthFormProps = {
  callbackPath: string
  mode: EmailAuthMode
  onSignUpEmailSent?: (email: string) => void
}

export function EmailAuthForm({
  callbackPath,
  mode,
  onSignUpEmailSent,
}: EmailAuthFormProps) {
  const router = useRouter()
  const isSignUp = mode === "sign-up"
  const switchAuthHref = createSwitchAuthHref({ callbackPath, isSignUp })
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [fieldErrors, setFieldErrors] = React.useState<EmailAuthFieldErrors>({})
  const [message, setMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  async function submitEmailAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    const emailAddress = email.trim()
    const validationErrors = validateEmailAuthInput({
      email: emailAddress,
      password,
    })

    setFieldErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      const result = isSignUp
        ? await authClient.signUp.email({
            callbackURL: EMAIL_VERIFICATION_CALLBACK_PATH,
            email: emailAddress,
            name: emailAddress,
            password,
          })
        : await authClient.signIn.email({
            callbackURL: callbackPath,
            email: emailAddress,
            password,
          })

      if (result.error) {
        if (!isSignUp && isEmailNotVerifiedError(result.error)) {
          await sendVerificationEmail(emailAddress)
          return
        }

        setMessage(result.error.message ?? "Authentication failed.")
        return
      }

      if (isSignUp) {
        onSignUpEmailSent?.(emailAddress)
        return
      }

      router.push(callbackPath)
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function sendVerificationEmail(emailAddress: string) {
    const result = await authClient.sendVerificationEmail({
      callbackURL: EMAIL_VERIFICATION_CALLBACK_PATH,
      email: emailAddress,
    })

    if (result.error) {
      setMessage(result.error.message ?? "Could not send verification email.")
      return
    }

    setMessage("Verification email sent.")
  }

  function updateField(
    field: EmailAuthField,
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
    <form className="flex flex-col gap-3" onSubmit={submitEmailAuth} noValidate>
      <FieldGroup className="gap-3">
        <Field
          data-disabled={isSubmitting || undefined}
          data-invalid={Boolean(fieldErrors.email)}
        >
          <FieldLabel
            htmlFor="email"
            className="text-[0.68rem] tracking-wide text-muted-foreground"
          >
            EMAIL
          </FieldLabel>
          <Input
            id="email"
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            aria-invalid={Boolean(fieldErrors.email)}
            autoComplete="email"
            disabled={isSubmitting}
            onChange={(event) =>
              updateField("email", event.target.value, setEmail)
            }
            type="email"
            value={email}
          />
          <FieldError id="email-error">{fieldErrors.email}</FieldError>
        </Field>
        <Field
          data-disabled={isSubmitting || undefined}
          data-invalid={Boolean(fieldErrors.password)}
        >
          <FieldLabel
            htmlFor="password"
            className="text-[0.68rem] tracking-wide text-muted-foreground"
          >
            PASSWORD
          </FieldLabel>
          <Input
            id="password"
            aria-describedby={
              fieldErrors.password ? "password-error" : undefined
            }
            aria-invalid={Boolean(fieldErrors.password)}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            disabled={isSubmitting}
            onChange={(event) =>
              updateField("password", event.target.value, setPassword)
            }
            type="password"
            value={password}
          />
          <FieldError id="password-error">{fieldErrors.password}</FieldError>
        </Field>
      </FieldGroup>
      <Button
        type="submit"
        className="w-full rounded-sm text-xs"
        disabled={isSubmitting}
      >
        {isSignUp ? "Create account" : "Sign in"}
      </Button>
      <p className="text-center text-[0.68rem] text-muted-foreground">
        {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
        <Link
          href={switchAuthHref}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {isSignUp ? "Sign in" : "Sign up"}
        </Link>
      </p>
      {message ? (
        <p
          className="text-center text-[0.68rem] text-muted-foreground"
          role="status"
        >
          {message}
        </p>
      ) : null}
      {!isSignUp ? (
        <p className="text-center text-[0.68rem] text-muted-foreground">
          <Link
            href={createForgotPasswordHref(callbackPath)}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Forgot your password?
          </Link>
        </p>
      ) : null}
    </form>
  )
}

function isEmailNotVerifiedError(error: { code?: string; message?: string }) {
  return (
    error.code === "EMAIL_NOT_VERIFIED" ||
    error.message === "Email not verified"
  )
}

function createSwitchAuthHref({
  callbackPath,
  isSignUp,
}: {
  callbackPath: string
  isSignUp: boolean
}) {
  const pathname = isSignUp ? "/login" : "/sign-up"

  if (callbackPath === "/") {
    return pathname
  }

  return `${pathname}?next=${encodeURIComponent(callbackPath)}`
}

function createForgotPasswordHref(callbackPath: string) {
  if (callbackPath === "/") {
    return FORGOT_PASSWORD_PATH
  }

  return `${FORGOT_PASSWORD_PATH}?next=${encodeURIComponent(callbackPath)}`
}
