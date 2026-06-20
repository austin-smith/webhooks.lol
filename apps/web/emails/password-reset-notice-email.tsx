import { EmailBodyText, EmailLayout } from "./components/email-layout"

export const PASSWORD_RESET_NOTICE_EMAIL_SUBJECT =
  "Your webhooks.lol password was reset"

export function PasswordResetNoticeEmail() {
  return (
    <EmailLayout
      heading="Your password was reset"
      preview="Your webhooks.lol password was reset."
    >
      <EmailBodyText>
        Your webhooks.lol password was reset successfully.
      </EmailBodyText>
      <EmailBodyText spacing="last">
        If you did not request a password reset, update your password
        immediately.
      </EmailBodyText>
    </EmailLayout>
  )
}

export default PasswordResetNoticeEmail
