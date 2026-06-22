import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { getUserDisplayName, UserAvatar } from "@/components/auth/user-avatar"

describe("user avatar helpers", () => {
  it("prefers a non-empty user name for display", () => {
    expect(
      getUserDisplayName({
        email: "person@example.com",
        image: null,
        name: "Person Example",
      })
    ).toBe("Person Example")
  })

  it("falls back to email when the stored name is blank", () => {
    expect(
      getUserDisplayName({
        email: "person@example.com",
        image: null,
        name: " ",
      })
    ).toBe("person@example.com")
  })

  it("uses the shadcn avatar fallback without rendering initials", () => {
    const html = renderToStaticMarkup(
      <UserAvatar
        interactive
        user={{ email: "viewer@example.com", image: null, name: "Viewer" }}
      />
    )

    expect(html).toContain('data-slot="avatar"')
    expect(html).toContain('data-slot="avatar-fallback"')
    expect(html).not.toContain(">VI<")
    expect(html).toContain("lucide-user")
    expect(html).toContain("group-hover/button:bg-accent")
    expect(html).toContain("group-aria-expanded/button:bg-accent")
  })
})
