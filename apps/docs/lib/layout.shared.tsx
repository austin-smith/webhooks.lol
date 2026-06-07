import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"
import { ExternalLink } from "lucide-react"

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: "https://github.com/austin-smith/webhooks.lol",
    nav: {
      title: "webhooks.lol docs",
    },
    links: [
      {
        text: (
          <>
            App
            <ExternalLink />
          </>
        ),
        url: "https://webhooks.lol",
        active: "none",
      },
    ],
  }
}
