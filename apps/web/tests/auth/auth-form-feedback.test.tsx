import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { AuthFormFeedback } from "@/components/auth/auth-form-feedback"

describe("AuthFormFeedback", () => {
  it("renders error feedback as an alert", () => {
    const html = renderToStaticMarkup(
      <AuthFormFeedback title="Invalid email or password." tone="error" />
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain("Invalid email or password.")
  })

  it("renders success feedback as a status callout", () => {
    const html = renderToStaticMarkup(
      <AuthFormFeedback title="Verification email sent." tone="success" />
    )

    expect(html).toContain('role="status"')
    expect(html).toContain("Verification email sent.")
    expect(html).toContain("text-status-live")
  })
})
