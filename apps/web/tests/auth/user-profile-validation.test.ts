import { describe, expect, it } from "vitest"

import {
  MAX_USER_PROFILE_IMAGE_URL_LENGTH,
  MAX_USER_PROFILE_NAME_LENGTH,
  normalizeUserProfileImage,
  normalizeUserProfileName,
  normalizeUserProfileUpdate,
} from "@/lib/auth/user-profile-validation"

describe("user profile validation", () => {
  it("normalizes valid user profile updates", () => {
    expect(
      normalizeUserProfileUpdate({
        image: " https://example.com/avatar.jpg ",
        name: " Person Example ",
      })
    ).toStrictEqual({
      data: {
        image: "https://example.com/avatar.jpg",
        name: "Person Example",
      },
      fieldErrors: {},
      formError: null,
      ok: true,
    })
  })

  it("clears blank avatar URLs", () => {
    expect(
      normalizeUserProfileUpdate({ image: " ", name: "Person" })
    ).toMatchObject({
      data: {
        image: null,
        name: "Person",
      },
      ok: true,
    })
  })

  it("rejects blank display names", () => {
    expect(
      normalizeUserProfileUpdate({ image: null, name: " " })
    ).toMatchObject({
      fieldErrors: {
        name: "Display name is required.",
      },
      ok: false,
    })
  })

  it("rejects long display names", () => {
    expect(
      normalizeUserProfileUpdate({
        image: null,
        name: "x".repeat(MAX_USER_PROFILE_NAME_LENGTH + 1),
      })
    ).toMatchObject({
      fieldErrors: {
        name: `Display name must be ${MAX_USER_PROFILE_NAME_LENGTH} characters or fewer.`,
      },
      ok: false,
    })
  })

  it("rejects non-https avatar URLs", () => {
    expect(
      normalizeUserProfileUpdate({
        image: "http://example.com/avatar.jpg",
        name: "Person",
      })
    ).toMatchObject({
      fieldErrors: {
        image: "Avatar URL must use HTTPS.",
      },
      ok: false,
    })
  })

  it("rejects invalid avatar URLs", () => {
    expect(
      normalizeUserProfileUpdate({
        image: "not a url",
        name: "Person",
      })
    ).toMatchObject({
      fieldErrors: {
        image: "Avatar URL must be a valid HTTPS URL.",
      },
      ok: false,
    })
  })

  it("rejects long avatar URLs", () => {
    expect(
      normalizeUserProfileUpdate({
        image: `https://example.com/${"x".repeat(MAX_USER_PROFILE_IMAGE_URL_LENGTH)}`,
        name: "Person",
      })
    ).toMatchObject({
      fieldErrors: {
        image: `Avatar URL must be ${MAX_USER_PROFILE_IMAGE_URL_LENGTH} characters or fewer.`,
      },
      ok: false,
    })
  })

  it("rejects unsupported user profile fields", () => {
    expect(
      normalizeUserProfileUpdate({
        name: "Person",
        role: "admin",
      })
    ).toStrictEqual({
      data: null,
      fieldErrors: {},
      formError: "Only name and avatar can be updated here.",
      ok: false,
    })
  })

  it("normalizes individual user profile fields", () => {
    expect(normalizeUserProfileName(" Person ")).toBe("Person")
    expect(normalizeUserProfileImage(" ")).toBeNull()
    expect(normalizeUserProfileImage(null)).toBeNull()
    expect(normalizeUserProfileImage(" https://example.com/avatar.png ")).toBe(
      "https://example.com/avatar.png"
    )
  })
})
