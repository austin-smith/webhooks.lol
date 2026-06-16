import Image from "next/image"
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: "https://github.com/austin-smith/webhooks.lol",
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
          <span>webhooks.lol</span>
        </span>
      ),
    },
  }
}
