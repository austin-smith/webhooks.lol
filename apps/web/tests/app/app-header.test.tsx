import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { AppHeader } from "@/components/app/app-header"

vi.mock("@/components/app/app-environment-badge", () => ({
  AppEnvironmentBadge: () => <span data-environment-badge="" />,
}))
vi.mock("@/components/app/app-header-menu", () => ({
  AppHeaderMenu: () => null,
}))
vi.mock("@/components/auth/app-auth-link", () => ({
  AppAuthLink: () => null,
}))
vi.mock("@/components/theme/display-dropdown-menu", () => ({
  DisplayDropdownMenu: () => null,
}))

const buildMetadata = {
  branch: "main",
  builtAt: "2026-08-02T20:25:00.000Z",
  commitSha: "0b194d4d5e6f7890abcdef1234567890abcdef12",
  commitSubject: "Add environment build details",
  dirty: false,
}

describe("AppHeader", () => {
  it("does not render the environment badge client boundary in production", () => {
    const html = renderToStaticMarkup(
      <AppHeader
        buildMetadata={buildMetadata}
        docsUrl={null}
        environment={{ kind: "production", name: "production" }}
        user={null}
      />
    )

    expect(html).not.toContain("data-environment-badge")
  })

  it("renders the environment badge client boundary outside production", () => {
    const html = renderToStaticMarkup(
      <AppHeader
        buildMetadata={buildMetadata}
        docsUrl={null}
        environment={{ kind: "non-production", name: "staging" }}
        user={null}
      />
    )

    expect(html).toContain("data-environment-badge")
  })
})
