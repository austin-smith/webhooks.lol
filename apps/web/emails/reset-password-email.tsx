import { EmailBodyText, PlainLink } from "./components/email-layout"
import { EmailLayout } from "./components/email-layout"
import { PrimaryEmailAction } from "./components/primary-email-action"

export type ResetPasswordEmailProps = {
  resetUrl: string
}

export const RESET_PASSWORD_EMAIL_SUBJECT = "Reset your webhooks.lol password"

export function ResetPasswordEmail({ resetUrl }: ResetPasswordEmailProps) {
  return (
    <EmailLayout
      heading="Reset your password"
      preview="Reset your webhooks.lol password."
    >
      <EmailBodyText>
        Use this secure link to reset your webhooks.lol password.
      </EmailBodyText>
      <PrimaryEmailAction href={resetUrl} label="Reset password" />
      <PlainLink href={resetUrl} />
      <EmailBodyText spacing="last">
        If you did not request a password reset, you can ignore this email.
      </EmailBodyText>
    </EmailLayout>
  )
}

ResetPasswordEmail.PreviewProps = {
  resetUrl: "https://webhooks.lol/reset-password?token=preview",
} satisfies ResetPasswordEmailProps

export default ResetPasswordEmail
