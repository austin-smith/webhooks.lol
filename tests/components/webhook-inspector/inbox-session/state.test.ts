import { describe, expect, it } from "vitest"

import {
  mergeCapturedRequest,
  normalizeInboxNames,
  normalizeInboxTokens,
  rememberInboxToken,
  renameInbox,
  selectRequest,
  selectRequestId,
} from "@/components/webhook-inspector/inbox-session/state"
import type { CapturedRequest } from "@/lib/webhooks/types"

function createRequest(id: string): CapturedRequest {
  return {
    id,
    token: "inbox-token",
    method: "POST",
    url: "/orders",
    path: "/orders",
    query: {},
    headers: {},
    bodyText: "",
    bodyBase64: "",
    bodySize: 0,
    contentType: null,
    receivedAt: `2026-06-05T00:00:0${id}.000Z`,
    ip: null,
  }
}

describe("inbox session state", () => {
  it("keeps selection when the selected request still exists", () => {
    const requests = [createRequest("1"), createRequest("2")]

    expect(selectRequest(requests, "2")?.id).toBe("2")
    expect(selectRequestId(requests, "2")).toBe("2")
  })

  it("falls back to the first request when selection disappears", () => {
    const requests = [createRequest("1"), createRequest("2")]

    expect(selectRequest(requests, "missing")?.id).toBe("1")
    expect(selectRequestId(requests, "missing")).toBe("1")
    expect(selectRequest([], "missing")).toBeNull()
    expect(selectRequestId([], "missing")).toBeNull()
  })

  it("moves live requests to the top without duplicating them", () => {
    const first = createRequest("1")
    const second = createRequest("2")
    const replacement = { ...first, method: "PATCH" }

    expect(mergeCapturedRequest([first, second], replacement)).toEqual([
      replacement,
      second,
    ])
  })

  it("normalizes recent inbox tokens", () => {
    expect(
      normalizeInboxTokens([
        "a",
        "",
        "b",
        "a",
        null,
        "c",
        "d",
        "e",
        "f",
        "g",
        "h",
        "i",
      ])
    ).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"])

    expect(rememberInboxToken("new", ["old", "new"])).toEqual(["new", "old"])
  })

  it("keeps inbox names only for known tokens", () => {
    expect(
      normalizeInboxNames(
        {
          a: "Alpha",
          b: "Beta",
          c: "",
          d: 42,
        },
        new Set(["a", "c", "d"])
      )
    ).toEqual({ a: "Alpha" })
  })

  it("renames and clears the active inbox name", () => {
    const currentNames = { active: "Old", other: "Other" }

    expect(
      renameInbox({
        currentNames,
        name: "New",
        recentTokens: ["other"],
        token: "active",
      })
    ).toEqual({ active: "New", other: "Other" })

    expect(
      renameInbox({
        currentNames,
        name: " ",
        recentTokens: ["other"],
        token: "active",
      })
    ).toEqual({ other: "Other" })
  })
})
