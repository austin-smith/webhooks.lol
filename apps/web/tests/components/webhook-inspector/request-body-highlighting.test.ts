import { describe, expect, it } from "vitest"

import { SYNTAX_THEME } from "@/components/theme/syntax-theme"
import { highlightRequestBody } from "@/components/webhook-inspector/request-body-highlighting"

describe("request body highlighting", () => {
  it("skips empty and plain text request bodies", async () => {
    await expect(
      highlightRequestBody({ language: "json", value: "" })
    ).resolves.toBe("")
    await expect(
      highlightRequestBody({ language: "text", value: "plain text" })
    ).resolves.toBe("")
  })

  it("uses the selected syntax theme pair", async () => {
    const githubHtml = await highlightRequestBody({
      language: "json",
      syntaxTheme: SYNTAX_THEME.GITHUB.value,
      value: '{"ok":true}',
    })
    const catppuccinHtml = await highlightRequestBody({
      language: "json",
      syntaxTheme: SYNTAX_THEME.CATPPUCCIN.value,
      value: '{"ok":true}',
    })

    expect(githubHtml).toContain("github-light")
    expect(githubHtml).toContain("github-dark")
    expect(catppuccinHtml).toContain("catppuccin-latte")
    expect(catppuccinHtml).toContain("catppuccin-mocha")
    expect(githubHtml).not.toBe(catppuccinHtml)
  })
})
