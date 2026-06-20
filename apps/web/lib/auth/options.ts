import type { BetterAuthOptions } from "better-auth/minimal"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin } from "better-auth/plugins/admin"

import * as schema from "@webhooks-lol/database/schema"
import {
  resolveRoleForNewUser,
  STANDARD_USER_ROLE,
} from "./first-user-role-policy"
import type { DrizzleDatabase } from "./types"

type AuthEmailUser = {
  email: string
}

type AuthEmailUrlInput = {
  url: string
  user: AuthEmailUser
}

type SyntheticUserInput = {
  additionalFields: Record<string, unknown>
  coreFields: Record<string, unknown>
  id: string
}

type SendAuthEmailInput = {
  html: string
  subject: string
  text: string
  to: string
}

type AuthRuntimeHooks = {
  sendAuthEmail?: (input: SendAuthEmailInput) => Promise<void>
}

export function createAuthOptions(
  database: DrizzleDatabase,
  runtimeHooks: AuthRuntimeHooks = {}
): BetterAuthOptions {
  const sendAuthEmail = runtimeHooks.sendAuthEmail ?? missingAuthEmailSender

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
      requireEmailVerification: true,
      async onExistingUserSignUp({ user }: { user: AuthEmailUser }) {
        const text =
          "We received a webhooks.lol signup request for this email address.\n\n" +
          "If you own this address, use the sign-in page to continue. " +
          "If your email still needs verification, signing in with your password will send a fresh verification link.\n\n" +
          "If this was not you, no action is needed."

        await sendAuthEmail({
          html:
            "<p>We received a webhooks.lol signup request for this email address.</p>" +
            "<p>If you own this address, use the sign-in page to continue. " +
            "If your email still needs verification, signing in with your password will send a fresh verification link.</p>" +
            "<p>If this was not you, no action is needed.</p>",
          subject: "Check your email for webhooks.lol",
          text,
          to: user.email,
        })
      },
      async sendResetPassword({ user, url }: AuthEmailUrlInput) {
        await sendAuthEmail({
          html: createActionEmailHtml({
            actionLabel: "Reset your password",
            actionUrl: url,
            intro: "Use this link to reset your webhooks.lol password:",
            outro: "If you did not request this, you can ignore this email.",
          }),
          subject: "Reset your webhooks.lol password",
          text: `Use this link to reset your webhooks.lol password:\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
          to: user.email,
        })
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
      async sendVerificationEmail({ user, url }: AuthEmailUrlInput) {
        await sendAuthEmail({
          html: createActionEmailHtml({
            actionLabel: "Verify your email address",
            actionUrl: url,
            intro: "Use this link to verify your webhooks.lol email address:",
            outro:
              "If you did not create an account, you can ignore this email.",
          }),
          subject: "Verify your webhooks.lol email address",
          text: `Use this link to verify your webhooks.lol email address:\n\n${url}\n\nIf you did not create an account, you can ignore this email.`,
          to: user.email,
        })
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
        enabled: true,
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

async function missingAuthEmailSender() {
  throw new Error("Auth email sender is not configured.")
}

function createActionEmailHtml({
  actionLabel,
  actionUrl,
  intro,
  outro,
}: {
  actionLabel: string
  actionUrl: string
  intro: string
  outro: string
}) {
  const escapedUrl = escapeHtml(actionUrl)

  return (
    `<p>${escapeHtml(intro)}</p>` +
    `<p><a href="${escapedUrl}">${escapeHtml(actionLabel)}</a></p>` +
    `<p>${escapeHtml(outro)}</p>`
  )
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}
