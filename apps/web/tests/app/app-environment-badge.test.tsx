import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { AppEnvironmentBadge } from "@/components/app/app-environment-badge"

const buildMetadata = {
  branch: "env-badge",
  builtAt: "2026-08-02T20:25:00.000Z",
  commitSha: "0b194d4d5e6f7890abcdef1234567890abcdef12",
  commitSubject: "Add environment build details",
  dirty: true,
}

describe("AppEnvironmentBadge", () => {
  it("renders an interactive non-production environment label", () => {
    const html = renderToStaticMarkup(
      <AppEnvironmentBadge
        buildMetadata={buildMetadata}
        environment={{ kind: "non-production", name: "develop" }}
      />
    )

    expect(html).toContain('data-slot="badge"')
    expect(html).toContain(
      'aria-label="Application environment: develop. Show build details"'
    )
    expect(html).toContain("DEVELOP")
    expect(html).toContain('data-variant="outline"')
    expect(html).toContain("text-muted-foreground")
    expect(html).not.toContain("<a")
    expect(html).toContain("<button")
    expect(html).toContain('aria-haspopup="dialog"')
  })

  it.each(["missing", "invalid-format", "too-long"] as const)(
    "renders an explicit unknown state for an %s environment",
    (issue) => {
      const html = renderToStaticMarkup(
        <AppEnvironmentBadge
          buildMetadata={buildMetadata}
          environment={{ issue, kind: "invalid" }}
        />
      )

      expect(html).toContain(
        'aria-label="Application environment is not configured correctly. Show build details"'
      )
      expect(html).toContain('data-variant="destructive"')
      expect(html).toContain("ENV UNKNOWN")
    }
  )
})
