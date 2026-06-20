import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/password-policy"

export type ForgotPasswordField = "email"
export type PasswordResetTokenField = "confirmedPassword" | "newPassword"

export type ForgotPasswordFieldErrors = Partial<
  Record<ForgotPasswordField, string>
>
export type PasswordResetTokenFieldErrors = Partial<
  Record<PasswordResetTokenField, string>
>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateForgotPasswordInput({
  email,
}: {
  email: string
}): ForgotPasswordFieldErrors {
  const errors: ForgotPasswordFieldErrors = {}

  if (!email) {
    errors.email = "Email is required."
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address."
  }

  return errors
}

export function validatePasswordResetTokenInput({
  confirmedPassword,
  newPassword,
}: {
  confirmedPassword: string
  newPassword: string
}): PasswordResetTokenFieldErrors {
  const errors: PasswordResetTokenFieldErrors = {}

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
