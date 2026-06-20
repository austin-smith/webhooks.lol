import { afterEach, describe, expect, it, vi } from "vitest"

import { sendAuthEmail } from "@/lib/auth/email"

const authEmail = {
  html: "<p>Verify your email.</p>",
  subject: "Verify your webhooks.lol email address",
  text: "Verify your email.",
  to: "owner@example.com",
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("sendAuthEmail", () => {
  it("sends auth email through the Cloudflare Email Sending REST API", async () => {
    const fetchMock = stubFetch(
      createCloudflareResponse({
        result: {
          delivered: [authEmail.to],
          permanent_bounces: [],
          queued: [],
        },
        success: true,
      })
    )

    stubCloudflareEmailEnv()

    await sendAuthEmail(authEmail)

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = getFetchCall(fetchMock)

    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/account-id/email/sending/send"
    )
    expect(init?.method).toBe("POST")
    expect(init?.headers).toEqual({
      Authorization: "Bearer cloudflare-email-token",
      "Content-Type": "application/json",
    })
    expect(JSON.parse(getStringBody(init))).toEqual({
      from: {
        address: "no-reply@webhooks.lol",
        name: "webhooks.lol",
      },
      html: authEmail.html,
      subject: authEmail.subject,
      text: authEmail.text,
      to: authEmail.to,
    })
  })

  it("labels non-production auth email by APP_ENV", async () => {
    const fetchMock = stubFetch(
      createCloudflareResponse({
        result: {
          delivered: [authEmail.to],
          permanent_bounces: [],
          queued: [],
        },
        success: true,
      })
    )

    stubCloudflareEmailEnv({ appEnv: "staging" })

    await sendAuthEmail(authEmail)

    const [, init] = getFetchCall(fetchMock)

    expect(JSON.parse(getStringBody(init)).from).toEqual({
      address: "no-reply@webhooks.lol",
      name: "webhooks.lol (staging)",
    })
  })

  it("uses non-production APP_ENV labels verbatim", async () => {
    const fetchMock = stubFetch(
      createCloudflareResponse({
        result: {
          delivered: [authEmail.to],
          permanent_bounces: [],
          queued: [],
        },
        success: true,
      })
    )

    stubCloudflareEmailEnv({ appEnv: "review_branch" })

    await sendAuthEmail(authEmail)

    const [, init] = getFetchCall(fetchMock)

    expect(JSON.parse(getStringBody(init)).from.name).toBe(
      "webhooks.lol (review_branch)"
    )
  })

  it("accepts queued recipients as a successful send", async () => {
    stubFetch(
      createCloudflareResponse({
        result: {
          delivered: [],
          permanent_bounces: [],
          queued: [authEmail.to],
        },
        success: true,
      })
    )
    stubCloudflareEmailEnv()

    await expect(sendAuthEmail(authEmail)).resolves.toBeUndefined()
  })

  it("requires APP_ENV before sending", async () => {
    const fetchMock = stubFetch(
      createCloudflareResponse({
        result: {
          delivered: [authEmail.to],
          permanent_bounces: [],
          queued: [],
        },
        success: true,
      })
    )

    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-id")
    vi.stubEnv("CLOUDFLARE_EMAIL_API_TOKEN", "cloudflare-email-token")
    vi.stubEnv("EMAIL_FROM_ADDRESS", "no-reply@webhooks.lol")

    await expect(sendAuthEmail(authEmail)).rejects.toThrow(
      "APP_ENV is required to send email."
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects blank APP_ENV before sending", async () => {
    const fetchMock = stubFetch(
      createCloudflareResponse({
        result: {
          delivered: [authEmail.to],
          permanent_bounces: [],
          queued: [],
        },
        success: true,
      })
    )

    stubCloudflareEmailEnv({ appEnv: " " })

    await expect(sendAuthEmail(authEmail)).rejects.toThrow(
      "APP_ENV is required to send email."
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects control characters in APP_ENV before sending", async () => {
    const fetchMock = stubFetch(
      createCloudflareResponse({
        result: {
          delivered: [authEmail.to],
          permanent_bounces: [],
          queued: [],
        },
        success: true,
      })
    )

    stubCloudflareEmailEnv({ appEnv: "staging\nbcc" })

    await expect(sendAuthEmail(authEmail)).rejects.toThrow(
      "APP_ENV must not contain control characters."
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("requires Cloudflare sender address configuration before sending", async () => {
    const fetchMock = stubFetch(
      createCloudflareResponse({
        result: {
          delivered: [authEmail.to],
          permanent_bounces: [],
          queued: [],
        },
        success: true,
      })
    )

    vi.stubEnv("APP_ENV", "production")
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-id")
    vi.stubEnv("CLOUDFLARE_EMAIL_API_TOKEN", "cloudflare-email-token")

    await expect(sendAuthEmail(authEmail)).rejects.toThrow(
      "EMAIL_FROM_ADDRESS is required to send email."
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("reports Cloudflare API errors without exposing request secrets", async () => {
    stubFetch(
      createCloudflareResponse(
        {
          errors: [
            {
              code: 10102,
              message: "email.sending.error.authentication.forbidden",
            },
          ],
          result: null,
          success: false,
        },
        { status: 403 }
      )
    )
    stubCloudflareEmailEnv()

    let error: unknown
    try {
      await sendAuthEmail(authEmail)
    } catch (caughtError) {
      error = caughtError
    }

    assertError(error)
    expect(error.message).toBe(
      "Could not send email. Cloudflare responded with HTTP 403 (10102: email.sending.error.authentication.forbidden)."
    )
    expect(error.message).not.toContain("cloudflare-email-token")
  })

  it("rejects permanent recipient bounces", async () => {
    stubFetch(
      createCloudflareResponse({
        result: {
          delivered: [],
          permanent_bounces: [authEmail.to],
          queued: [],
        },
        success: true,
      })
    )
    stubCloudflareEmailEnv()

    await expect(sendAuthEmail(authEmail)).rejects.toThrow(
      "Could not send email. Cloudflare reported a permanent bounce for the recipient."
    )
  })

  it("rejects successful responses that do not account for the recipient", async () => {
    stubFetch(
      createCloudflareResponse({
        result: {
          delivered: [],
          permanent_bounces: [],
          queued: [],
        },
        success: true,
      })
    )
    stubCloudflareEmailEnv()

    await expect(sendAuthEmail(authEmail)).rejects.toThrow(
      "Could not send email. Cloudflare did not report the recipient as delivered or queued."
    )
  })

  it("rejects malformed Cloudflare responses", async () => {
    stubFetch(new Response(JSON.stringify({ success: true }), { status: 200 }))
    stubCloudflareEmailEnv()

    await expect(sendAuthEmail(authEmail)).rejects.toThrow(
      "Could not send email. Cloudflare returned an unexpected response."
    )
  })
})

function stubCloudflareEmailEnv({
  appEnv = "production",
}: { appEnv?: string } = {}) {
  vi.stubEnv("APP_ENV", appEnv)
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-id")
  vi.stubEnv("CLOUDFLARE_EMAIL_API_TOKEN", "cloudflare-email-token")
  vi.stubEnv("EMAIL_FROM_ADDRESS", "no-reply@webhooks.lol")
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response)

  vi.stubGlobal("fetch", fetchMock)

  return fetchMock
}

function getFetchCall(fetchMock: ReturnType<typeof stubFetch>) {
  const call = fetchMock.mock.calls[0]

  if (!call) {
    throw new Error("Expected fetch to be called.")
  }

  return call
}

function getStringBody(init: RequestInit | undefined) {
  if (typeof init?.body !== "string") {
    throw new Error("Expected fetch body to be a JSON string.")
  }

  return init.body
}

function assertError(value: unknown): asserts value is Error {
  expect(value).toBeInstanceOf(Error)
}

function createCloudflareResponse(
  body: {
    errors?: Array<{ code: number; message: string }>
    result: {
      delivered: string[]
      permanent_bounces: string[]
      queued: string[]
    } | null
    success: boolean
  },
  init: ResponseInit = {}
) {
  return new Response(
    JSON.stringify({
      errors: body.errors ?? [],
      messages: [],
      result: body.result,
      success: body.success,
    }),
    {
      headers: { "Content-Type": "application/json" },
      status: init.status ?? 200,
    }
  )
}
