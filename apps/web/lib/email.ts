import "server-only"

export type OutboundEmail = {
  html: string
  subject: string
  text: string
  to: string
}

type CloudflareEmailAddress = {
  address: string
  name: string
}

type CloudflareSendEmailRequest = {
  from: CloudflareEmailAddress
  html: string
  subject: string
  text: string
  to: string
}

type CloudflareSendEmailResult = {
  delivered: string[]
  permanent_bounces: string[]
  queued: string[]
}

type CloudflareApiError = {
  code: number
  message: string
}

type CloudflareSendEmailResponse = {
  errors: CloudflareApiError[]
  messages: unknown[]
  result: CloudflareSendEmailResult | null
  success: boolean
}

const CLOUDFLARE_EMAIL_SEND_URL =
  "https://api.cloudflare.com/client/v4/accounts"
const PRODUCT_EMAIL_SENDER_NAME = "webhooks.lol"
const PRODUCTION_APP_ENV = "production"

export async function sendOutboundEmail({
  html,
  subject,
  text,
  to,
}: OutboundEmail) {
  const response = await fetch(buildCloudflareEmailSendUrl(), {
    body: JSON.stringify({
      from: {
        address: readRequiredEnv("EMAIL_FROM_ADDRESS"),
        name: readEmailFromName(),
      },
      html,
      subject,
      text,
      to,
    } satisfies CloudflareSendEmailRequest),
    headers: {
      Authorization: `Bearer ${readRequiredEnv("CLOUDFLARE_EMAIL_API_TOKEN")}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  })

  const body = await readJsonResponse(response)

  if (!response.ok) {
    throw new Error(
      `Could not send email. Cloudflare responded with HTTP ${response.status}${formatCloudflareErrors(body)}.`
    )
  }

  if (!isCloudflareSendEmailResponse(body) || !body.success || !body.result) {
    throw new Error(
      `Could not send email. Cloudflare returned an unexpected response${formatCloudflareErrors(body)}.`
    )
  }

  if (body.result.permanent_bounces.includes(to)) {
    throw new Error(
      "Could not send email. Cloudflare reported a permanent bounce for the recipient."
    )
  }

  if (!body.result.delivered.includes(to) && !body.result.queued.includes(to)) {
    throw new Error(
      "Could not send email. Cloudflare did not report the recipient as delivered or queued."
    )
  }
}

function buildCloudflareEmailSendUrl() {
  const accountId = readRequiredEnv("CLOUDFLARE_ACCOUNT_ID")

  return `${CLOUDFLARE_EMAIL_SEND_URL}/${encodeURIComponent(accountId)}/email/sending/send`
}

function readEmailFromName() {
  const appEnv = readRequiredEnv("APP_ENV")

  if (appEnv === PRODUCTION_APP_ENV) {
    return PRODUCT_EMAIL_SENDER_NAME
  }

  return `${PRODUCT_EMAIL_SENDER_NAME} (${appEnv})`
}

async function readJsonResponse(response: Response) {
  try {
    return (await response.json()) as unknown
  } catch {
    return null
  }
}

function formatCloudflareErrors(body: unknown) {
  if (!hasCloudflareErrors(body)) {
    return ""
  }

  const details = body.errors
    .map((error) => `${error.code}: ${error.message}`)
    .join("; ")

  return details ? ` (${details})` : ""
}

function isCloudflareSendEmailResponse(
  value: unknown
): value is CloudflareSendEmailResponse {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.success === "boolean" &&
    Array.isArray(value.messages) &&
    hasCloudflareErrors(value) &&
    (value.result === null || isCloudflareSendEmailResult(value.result))
  )
}

function hasCloudflareErrors(
  value: unknown
): value is Record<string, unknown> & { errors: CloudflareApiError[] } {
  if (!isRecord(value) || !Array.isArray(value.errors)) {
    return false
  }

  return value.errors.every(isCloudflareApiError)
}

function isCloudflareApiError(value: unknown): value is CloudflareApiError {
  if (!isRecord(value)) {
    return false
  }

  return typeof value.code === "number" && typeof value.message === "string"
}

function isCloudflareSendEmailResult(
  value: unknown
): value is CloudflareSendEmailResult {
  if (!isRecord(value)) {
    return false
  }

  return (
    isStringArray(value.delivered) &&
    isStringArray(value.permanent_bounces) &&
    isStringArray(value.queued)
  )
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required to send email.`)
  }

  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`${name} must not contain control characters.`)
  }

  return value
}
