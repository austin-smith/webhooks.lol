import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: "https://github.com/austin-smith/webhooks.lol",
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
