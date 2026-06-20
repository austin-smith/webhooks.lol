import { EmailBodyText, PlainLink } from "./components/email-layout"
import { EmailLayout } from "./components/email-layout"
import { PrimaryEmailAction } from "./components/primary-email-action"

export type VerifyEmailProps = {
  verificationUrl: string
}

export const VERIFY_EMAIL_SUBJECT = "Verify your webhooks.lol email address"

export function VerifyEmail({ verificationUrl }: VerifyEmailProps) {
  return (
    <EmailLayout
      heading="Verify your email address"
      preview="Verify your webhooks.lol email address."
    >
      <EmailBodyText>
        Use this secure link to verify your webhooks.lol email address.
      </EmailBodyText>
      <PrimaryEmailAction href={verificationUrl} label="Verify email" />
      <PlainLink href={verificationUrl} />
      <EmailBodyText spacing="last">
        If you did not create a webhooks.lol account, you can ignore this email.
      </EmailBodyText>
    </EmailLayout>
  )
}

VerifyEmail.PreviewProps = {
  verificationUrl: "https://webhooks.lol/email-verified?token=preview",
} satisfies VerifyEmailProps

export default VerifyEmail
