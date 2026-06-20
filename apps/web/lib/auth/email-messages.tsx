import "server-only"

import type { ReactElement } from "react"
import { render, toPlainText } from "react-email"

import {
  PASSWORD_RESET_NOTICE_EMAIL_SUBJECT,
  PasswordResetNoticeEmail,
} from "@/emails/password-reset-notice-email"
import {
  RESET_PASSWORD_EMAIL_SUBJECT,
  ResetPasswordEmail,
} from "@/emails/reset-password-email"
import { VERIFY_EMAIL_SUBJECT, VerifyEmail } from "@/emails/verify-email"

type EmailMessage = {
  html: string
  subject: string
  text: string
  to: string
}

type ActionEmailInput = {
  to: string
  url: string
}

type NoticeEmailInput = {
  to: string
}

export async function createVerifyEmailMessage({
  to,
  url,
}: ActionEmailInput): Promise<EmailMessage> {
  return createEmailMessage({
    email: <VerifyEmail verificationUrl={url} />,
    subject: VERIFY_EMAIL_SUBJECT,
    to,
  })
}

export async function createResetPasswordEmailMessage({
  to,
  url,
}: ActionEmailInput): Promise<EmailMessage> {
  return createEmailMessage({
    email: <ResetPasswordEmail resetUrl={url} />,
    subject: RESET_PASSWORD_EMAIL_SUBJECT,
    to,
  })
}

export async function createPasswordResetNoticeEmailMessage({
  to,
}: NoticeEmailInput): Promise<EmailMessage> {
  return createEmailMessage({
    email: <PasswordResetNoticeEmail />,
    subject: PASSWORD_RESET_NOTICE_EMAIL_SUBJECT,
    to,
  })
}

async function createEmailMessage({
  email,
  subject,
  to,
}: {
  email: ReactElement
  subject: string
  to: string
}): Promise<EmailMessage> {
  const html = await render(email, { pretty: true })

  return {
    html,
    subject,
    text: toPlainText(html),
    to,
  }
}
