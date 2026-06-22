import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { AccountMenuIdentity } from "@/components/auth/account-menu-identity"

describe("AccountMenuIdentity", () => {
  it("renders a compact account identity panel for menus", () => {
    const html = renderToStaticMarkup(
      <AccountMenuIdentity
        user={{
          email: "person@example.com",
          image: null,
          name: "Person Example",
        }}
      />
    )

    expect(html).toContain("bg-muted/40")
    expect(html).toContain('data-slot="avatar"')
    expect(html).toContain('data-size="default"')
    expect(html).toContain("Person Example")
    expect(html).toContain("person@example.com")
  })
})
