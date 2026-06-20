import type { BetterAuthOptions } from "better-auth/minimal"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin } from "better-auth/plugins/admin"
import { and, eq } from "drizzle-orm"

import * as schema from "@webhooks-lol/database/schema"
import { account } from "@webhooks-lol/database/schema"
import {
  createPasswordResetNoticeEmailMessage,
  createResetPasswordEmailMessage,
  createVerifyEmailMessage,
} from "./email-messages"
import {
  resolveRoleForNewUser,
  STANDARD_USER_ROLE,
} from "./first-user-role-policy"
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./password-policy"
import type { DrizzleDatabase } from "./types"

type EmailUser = {
  email: string
  id: string
}

type EmailUrlInput = {
  url: string
  user: EmailUser
}

type EmailUserInput = {
  user: EmailUser
}

type SyntheticUserInput = {
  additionalFields: Record<string, unknown>
  coreFields: Record<string, unknown>
  id: string
}

type SendEmailInput = {
  html: string
  subject: string
  text: string
  to: string
}

type AuthRuntimeHooks = {
  sendEmail?: (input: SendEmailInput) => Promise<void>
}

export function createAuthOptions(
  database: DrizzleDatabase,
  runtimeHooks: AuthRuntimeHooks = {}
): BetterAuthOptions {
  const sendEmail = runtimeHooks.sendEmail ?? missingEmailSender

  return {
    appName: "webhooks.lol",
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
      transaction: true,
    }),
    databaseHooks: {
      user: {
        create: {
          async before(newUser) {
            return {
              data: {
                ...newUser,
                role: await resolveRoleForNewUser(database),
              },
            }
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      requireEmailVerification: true,
      async onPasswordReset({ user }: EmailUserInput) {
        void createPasswordResetNoticeEmailMessage({
          to: user.email,
        })
          .then(sendEmail)
          .catch((error: unknown) => {
            console.error("Could not send password reset notification.", error)
          })
      },
      async sendResetPassword({ user, url }: EmailUrlInput) {
        if (!(await userHasCredentialAccount(database, user.id))) {
          return
        }

        await sendEmail(
          await createResetPasswordEmailMessage({
            to: user.email,
            url,
          })
        )
      },
      customSyntheticUser: ({
        additionalFields,
        coreFields,
        id,
      }: SyntheticUserInput) => ({
        ...coreFields,
        role: STANDARD_USER_ROLE,
        banned: false,
        banReason: null,
        banExpires: null,
        ...additionalFields,
        id,
      }),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      async sendVerificationEmail({ user, url }: EmailUrlInput) {
        await sendEmail(
          await createVerifyEmailMessage({
            to: user.email,
            url,
          })
        )
      },
    },
    plugins: [admin()],
    socialProviders: {
      github: {
        clientId: readRequiredEnv("GITHUB_CLIENT_ID"),
        clientSecret: readRequiredEnv("GITHUB_CLIENT_SECRET"),
        scope: ["user:email"],
      },
    },
    account: {
      accountLinking: {
        enabled: false,
      },
      encryptOAuthTokens: true,
      storeStateStrategy: "database" as const,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      storeSessionInDatabase: true,
    },
    advanced: {
      backgroundTasks: {
        handler(promise) {
          void promise
        },
      },
      useSecureCookies: process.env.NODE_ENV === "production",
    },
  }
}

function readRequiredEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required to use GitHub authentication.`)
  }

  return value
}

async function missingEmailSender() {
  throw new Error("Email sender is not configured.")
}

async function userHasCredentialAccount(
  database: DrizzleDatabase,
  userId: string
) {
  const rows = await database
    .select({ id: account.id })
    .from(account)
    .where(
      and(eq(account.userId, userId), eq(account.providerId, "credential"))
    )
    .limit(1)

  return rows.length > 0
}
