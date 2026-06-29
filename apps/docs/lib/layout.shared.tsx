import Image from "next/image"
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"
import { ExternalLinkIcon } from "lucide-react"

import { readAppUrl } from "@/lib/app-urls"

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: "https://github.com/austin-smith/webhooks.lol",
    links: [
      {
        type: "button",
        icon: <ExternalLinkIcon />,
        text: "Open webhooks.lol",
        url: readAppUrl().toString(),
        external: true,
        active: "none",
      },
    ],
    nav: {
      title: (
        <span className="inline-flex items-center gap-2">
          <Image
            src="/logo.png"
            alt=""
            width={18}
            height={18}
            aria-hidden="true"
            className="size-[18px]"
          />
          <span className="text-fd-foreground font-heading text-sm font-semibold tracking-tight">
            WEBHOOKS<span className="text-brand">.LOL</span>
          </span>
        </span>
      ),
    },
  }
}
