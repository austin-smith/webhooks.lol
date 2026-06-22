import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/auth/app-account-menu", () => ({
  AppAccountMenu({ user }: { user: { email: string } }) {
    return <div data-account-menu="true">{user.email}</div>
  },
}))

import { AppAuthLink } from "@/components/auth/app-auth-link"

describe("AppAuthLink", () => {
  it("renders sign in only when the server resolved no header user", () => {
    const html = renderToStaticMarkup(<AppAuthLink user={null} />)

    expect(html).toContain('href="/login"')
    expect(html).toContain("LOGIN")
  })

  it("renders the account menu when the server resolved a header user", () => {
    const html = renderToStaticMarkup(
      <AppAuthLink
        user={{
          email: "person@example.com",
          image: null,
          name: "Person Example",
        }}
      />
    )

    expect(html).toContain('data-account-menu="true"')
    expect(html).toContain("person@example.com")
    expect(html).not.toContain("LOGIN")
  })
})
