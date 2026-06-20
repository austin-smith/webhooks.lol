import { afterEach, describe, expect, it, vi } from "vitest"

import { createAuthOptions } from "@/lib/auth/options"
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
    onExistingUserSignUp(input: { user: { email: string } }): Promise<void>
    requireEmailVerification: boolean
    sendResetPassword(input: {
      url: string
      user: { email: string }
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
    expect(options.account.accountLinking.enabled).toBe(true)
  })

  it("uses neutral duplicate-signup email copy", async () => {
    const sendAuthEmail = vi.fn().mockResolvedValue(undefined)
    const options = createOptions(sendAuthEmail)

    await options.emailAndPassword.onExistingUserSignUp({
      user: { email: "owner@example.com" },
    })

    expect(sendAuthEmail).toHaveBeenCalledWith({
      html:
        "<p>We received a webhooks.lol signup request for this email address.</p>" +
        "<p>If you own this address, use the sign-in page to continue. " +
        "If your email still needs verification, signing in with your password will send a fresh verification link.</p>" +
        "<p>If this was not you, no action is needed.</p>",
      subject: "Check your email for webhooks.lol",
      text:
        "We received a webhooks.lol signup request for this email address.\n\n" +
        "If you own this address, use the sign-in page to continue. " +
        "If your email still needs verification, signing in with your password will send a fresh verification link.\n\n" +
        "If this was not you, no action is needed.",
      to: "owner@example.com",
    })
  })

  it("sends reset password email with text and escaped html bodies", async () => {
    const sendAuthEmail = vi.fn().mockResolvedValue(undefined)
    const options = createOptions(sendAuthEmail)
    const url = "https://webhooks.lol/reset?token=abc&next=%22home%22"

    await options.emailAndPassword.sendResetPassword({
      url,
      user: { email: "owner@example.com" },
    })

    expect(sendAuthEmail).toHaveBeenCalledWith({
      html:
        "<p>Use this link to reset your webhooks.lol password:</p>" +
        '<p><a href="https://webhooks.lol/reset?token=abc&amp;next=%22home%22">Reset your password</a></p>' +
        "<p>If you did not request this, you can ignore this email.</p>",
      subject: "Reset your webhooks.lol password",
      text: `Use this link to reset your webhooks.lol password:\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
      to: "owner@example.com",
    })
  })

  it("sends verification email with text and escaped html bodies", async () => {
    const sendAuthEmail = vi.fn().mockResolvedValue(undefined)
    const options = createOptions(sendAuthEmail)
    const url = "https://webhooks.lol/verify?token=abc&next=%22home%22"

    await options.emailVerification.sendVerificationEmail({
      url,
      user: { email: "owner@example.com" },
    })

    expect(sendAuthEmail).toHaveBeenCalledWith({
      html:
        "<p>Use this link to verify your webhooks.lol email address:</p>" +
        '<p><a href="https://webhooks.lol/verify?token=abc&amp;next=%22home%22">Verify your email address</a></p>' +
        "<p>If you did not create an account, you can ignore this email.</p>",
      subject: "Verify your webhooks.lol email address",
      text: `Use this link to verify your webhooks.lol email address:\n\n${url}\n\nIf you did not create an account, you can ignore this email.`,
      to: "owner@example.com",
    })
  })
})

type SendAuthEmailSpy = (input: {
  html: string
  subject: string
  text: string
  to: string
}) => Promise<void>

function createOptions(
  sendAuthEmail: SendAuthEmailSpy | undefined = vi
    .fn()
    .mockResolvedValue(undefined),
  database: DrizzleDatabase = createDatabaseWithUserCount(0)
) {
  vi.stubEnv("GITHUB_CLIENT_ID", "github-client-id")
  vi.stubEnv("GITHUB_CLIENT_SECRET", "github-client-secret")

  return createAuthOptions(database, {
    sendAuthEmail,
  }) as AuthOptionsUnderTest
}

function createDatabaseWithUserCount(userCount: number) {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(() => ({
      from: vi.fn(async () => [{ value: userCount }]),
    })),
  } as unknown as DrizzleDatabase
}
