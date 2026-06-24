import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/password-policy"

export type EmailAuthField = "email" | "password"

export type EmailAuthFieldErrors = Partial<Record<EmailAuthField, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmailAuthInput({
  email,
  password,
}: {
  email: string
  password: string
}): EmailAuthFieldErrors {
  const errors: EmailAuthFieldErrors = {}

  if (!email) {
    errors.email = "Email is required."
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address."
  }

  if (!password) {
    errors.password = "Password is required."
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.password = "Password is too long."
  }

  return errors
}
