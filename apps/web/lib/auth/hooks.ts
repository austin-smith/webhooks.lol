import { APIError, createAuthMiddleware } from "better-auth/api"

import { normalizeUserProfileUpdate } from "./user-profile-validation"

type AuthBeforeHookContext = {
  body: unknown
  path: string
}

export function createAuthBeforeHook() {
  return createAuthMiddleware(handleAuthBeforeHook)
}

export async function handleAuthBeforeHook<
  Context extends AuthBeforeHookContext,
>(ctx: Context) {
  if (ctx.path !== "/update-user") {
    return
  }

  const validation = normalizeUserProfileUpdate(ctx.body)

  if (!validation.ok) {
    throw new APIError("BAD_REQUEST", {
      message:
        validation.formError ??
        Object.values(validation.fieldErrors)[0] ??
        "Invalid profile update.",
    })
  }

  return {
    context: {
      ...ctx,
      body: validation.data,
    },
  }
}
