import { afterEach, describe, expect, it, vi } from "vitest"

import { createAuthOptions } from "@/lib/auth/options"
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/password-policy"
import type { DrizzleDatabase } from "@/lib/auth/types"

type AuthOptionsUnderTest = ReturnType<typeof createAuthOptions> & {
  databaseHooks: {
    user: {
      create: {
        before(newUser: Record<string, unknown>): Promise<{
          data: Record<string, unknown>
        }>
      }
    }
  }
  emailAndPassword: {
    maxPasswordLength: number
    minPasswordLength: number
    onPasswordReset(input: {
      user: { email: string; id: string }
    }): Promise<void>
    resetPasswordTokenExpiresIn: number
    revokeSessionsOnPasswordReset: boolean
    requireEmailVerification: boolean
    sendResetPassword(input: {
      url: string
      user: { email: string; id: string }
    }): Promise<void>
  }
  emailVerification: {
    sendVerificationEmail(input: {
      url: string
      user: { email: string }
    }): Promise<void>
    sendOnSignIn: boolean
    sendOnSignUp: boolean
  }
  socialProviders: {
    github: {
      scope: string[]
    }
  }
  account: {
    accountLinking: {
      enabled: boolean
    }
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("auth options", () => {
  it("requires email verification and sends verification emails on signup", () => {
    const options = createOptions()

    expect(options.emailAndPassword.requireEmailVerification).toBe(true)
    expect(options.emailAndPassword.minPasswordLength).toBe(MIN_PASSWORD_LENGTH)
    expect(options.emailAndPassword.maxPasswordLength).toBe(MAX_PASSWORD_LENGTH)
    expect(options.emailAndPassword.resetPasswordTokenExpiresIn).toBe(60 * 60)
    expect(options.emailAndPassword.revokeSessionsOnPasswordReset).toBe(true)
    expect(options.emailVerification.sendOnSignUp).toBe(true)
    expect(options.emailVerification.sendOnSignIn).toBe(false)
  })

  it("assigns the first new user as admin", async () => {
    const options = createOptions(undefined, createDatabaseWithUserCount(0))

    await expect(
      options.databaseHooks.user.create.before({
        email: "owner@example.com",
      })
    ).resolves.toMatchObject({
      data: {
        email: "owner@example.com",
        role: "admin",
      },
    })
  })

  it("keeps later new users as standard users", async () => {
    const options = createOptions(undefined, createDatabaseWithUserCount(1))

    await expect(
      options.databaseHooks.user.create.before({
        email: "user@example.com",
        role: "admin",
      })
    ).resolves.toMatchObject({
      data: {
        email: "user@example.com",
        role: "user",
      },
    })
  })

  it("keeps GitHub as a normal social provider", () => {
    const options = createOptions(undefined, createDatabaseWithUserCount(1))

    expect(options.socialProviders.github).toMatchObject({
      scope: ["user:email"],
    })
    expect(options.socialProviders.github).not.toHaveProperty(
      "mapProfileToUser"
    )
    expect(options.account.accountLinking.enabled).toBe(false)
  })

  it("sends reset password email with rendered html and text bodies", async () => {
    const sendEmail = vi.fn().mockResolvedValue(undefined)
    const options = createOptions(
      sendEmail,
      createDatabaseWithUserCount(1, { hasCredentialAccount: true })
    )
    const url = "https://webhooks.lol/reset?token=abc&next=%22home%22"

    await options.emailAndPassword.sendResetPassword({
      url,
      user: createAuthUser({ email: "owner@example.com", id: "user-id" }),
    })

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Reset your password"),
        subject: "Reset your webhooks.lol password",
        text: expect.stringContaining(url),
        to: "owner@example.com",
      })
    )
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining(
          "https://webhooks.lol/reset?token=abc&amp;next=%22home%22"
        ),
      })
    )
  })

  it("does not send reset password email for social-only users", async () => {
    const sendEmail = vi.fn().mockResolvedValue(undefined)
    const options = createOptions(
      sendEmail,
      createDatabaseWithUserCount(1, { hasCredentialAccount: false })
    )

    await options.emailAndPassword.sendResetPassword({
      url: "https://webhooks.lol/reset?token=abc",
      user: createAuthUser({ email: "owner@example.com", id: "user-id" }),
    })

    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("sends notification email after password reset", async () => {
    const sendEmail = vi.fn().mockResolvedValue(undefined)
    const options = createOptions(sendEmail)

    await options.emailAndPassword.onPasswordReset({
      user: createAuthUser({ email: "owner@example.com", id: "user-id" }),
    })

    await waitForMockCall(sendEmail)

    expect(sendEmail).toHaveBeenCalledWith({
      html: expect.stringContaining("Your password was reset"),
      subject: "Your webhooks.lol password was reset",
      text: expect.stringContaining("Your webhooks.lol password was reset"),
      to: "owner@example.com",
    })
  })

  it("sends verification email with rendered html and text bodies", async () => {
    const sendEmail = vi.fn().mockResolvedValue(undefined)
    const options = createOptions(sendEmail)
    const url = "https://webhooks.lol/verify?token=abc&next=%22home%22"

    await options.emailVerification.sendVerificationEmail({
      url,
      user: createAuthUser({ email: "owner@example.com", id: "user-id" }),
    })

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Verify your email address"),
        subject: "Verify your webhooks.lol email address",
        text: expect.stringContaining(url),
        to: "owner@example.com",
      })
    )
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining(
          "https://webhooks.lol/verify?token=abc&amp;next=%22home%22"
        ),
      })
    )
  })
})

type SendEmailSpy = (input: {
  html: string
  subject: string
  text: string
  to: string
}) => Promise<void>

async function waitForMockCall(mock: ReturnType<typeof vi.fn>) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (mock.mock.calls.length > 0) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  throw new Error("Expected mock to be called.")
}

function createAuthUser({ email, id }: { email: string; id: string }) {
  const now = new Date("2026-01-01T00:00:00.000Z")

  return {
    createdAt: now,
    email,
    emailVerified: true,
    id,
    image: null,
    name: email,
    updatedAt: now,
  }
}

function createOptions(
  sendEmail: SendEmailSpy | undefined = vi.fn().mockResolvedValue(undefined),
  database: DrizzleDatabase = createDatabaseWithUserCount(0)
) {
  vi.stubEnv("GITHUB_CLIENT_ID", "github-client-id")
  vi.stubEnv("GITHUB_CLIENT_SECRET", "github-client-secret")

  return createAuthOptions(database, {
    sendEmail,
  }) as AuthOptionsUnderTest
}

function createDatabaseWithUserCount(
  userCount: number,
  { hasCredentialAccount = true }: { hasCredentialAccount?: boolean } = {}
) {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn((selection?: Record<string, unknown>) => ({
      from: vi.fn(() => {
        if (selection && "id" in selection) {
          return {
            where: vi.fn(() => ({
              limit: vi.fn(async () =>
                hasCredentialAccount ? [{ id: "account-id" }] : []
              ),
            })),
          }
        }

        return Promise.resolve([{ value: userCount }])
      }),
    })),
  } as unknown as DrizzleDatabase
}
