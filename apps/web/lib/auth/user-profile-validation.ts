export const MAX_USER_PROFILE_NAME_LENGTH = 80
export const MAX_USER_PROFILE_IMAGE_URL_LENGTH = 2048

export type UserProfileField = "image" | "name"

export type UserProfileFieldErrors = Partial<Record<UserProfileField, string>>

export type NormalizedUserProfile = {
  image?: string | null
  name?: string
}

export type UserProfileValidationResult =
  | {
      data: NormalizedUserProfile
      fieldErrors: UserProfileFieldErrors
      formError: null
      ok: true
    }
  | {
      data: null
      fieldErrors: UserProfileFieldErrors
      formError: string | null
      ok: false
    }

const USER_PROFILE_FIELDS = new Set(["image", "name"])

export function normalizeUserProfileUpdate(
  body: unknown
): UserProfileValidationResult {
  if (!isObjectRecord(body)) {
    return {
      data: null,
      fieldErrors: {},
      formError: "Profile update body must be an object.",
      ok: false,
    }
  }

  const unknownFields = Object.keys(body).filter(
    (field) => !USER_PROFILE_FIELDS.has(field)
  )

  if (unknownFields.length > 0) {
    return {
      data: null,
      fieldErrors: {},
      formError: "Only name and avatar can be updated here.",
      ok: false,
    }
  }

  if (!("name" in body) && !("image" in body)) {
    return {
      data: null,
      fieldErrors: {},
      formError: "No profile fields to update.",
      ok: false,
    }
  }

  const data: NormalizedUserProfile = {}
  const fieldErrors: UserProfileFieldErrors = {}

  if ("name" in body) {
    if (typeof body.name !== "string") {
      fieldErrors.name = "Display name must be text."
    } else {
      const name = normalizeUserProfileName(body.name)
      const error = validateUserProfileName(name)

      if (error) {
        fieldErrors.name = error
      } else {
        data.name = name
      }
    }
  }

  if ("image" in body) {
    if (body.image !== null && typeof body.image !== "string") {
      fieldErrors.image = "Avatar URL must be text."
    } else {
      const image = normalizeUserProfileImage(body.image)
      const error = validateUserProfileImage(image)

      if (error) {
        fieldErrors.image = error
      } else {
        data.image = image
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      data: null,
      fieldErrors,
      formError: null,
      ok: false,
    }
  }

  return {
    data,
    fieldErrors: {},
    formError: null,
    ok: true,
  }
}

export function normalizeUserProfileName(value: string) {
  return value.trim()
}

export function normalizeUserProfileImage(value: string | null) {
  if (value === null) {
    return null
  }

  const image = value.trim()
  return image ? image : null
}

function validateUserProfileName(value: string) {
  if (!value) {
    return "Display name is required."
  }

  if (value.length > MAX_USER_PROFILE_NAME_LENGTH) {
    return `Display name must be ${MAX_USER_PROFILE_NAME_LENGTH} characters or fewer.`
  }

  return null
}

function validateUserProfileImage(value: string | null) {
  if (value === null) {
    return null
  }

  if (value.length > MAX_USER_PROFILE_IMAGE_URL_LENGTH) {
    return `Avatar URL must be ${MAX_USER_PROFILE_IMAGE_URL_LENGTH} characters or fewer.`
  }

  let url: URL

  try {
    url = new URL(value)
  } catch {
    return "Avatar URL must be a valid HTTPS URL."
  }

  if (url.protocol !== "https:") {
    return "Avatar URL must use HTTPS."
  }

  return null
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
