import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "webhooks.lol docs",
    },
    links: [
      {
        text: "App",
        url: "https://webhooks.lol",
        active: "none",
      },
    ],
  }
}
