import { docs } from "collections/server"
import { loader } from "fumadocs-core/source"
import type { LucideIcon } from "lucide-react"
import {
  BookOpenTextIcon,
  BracesIcon,
  ForwardIcon,
  GaugeIcon,
  Repeat2Icon,
  SearchIcon,
  SlidersHorizontalIcon,
  TerminalIcon,
  WebhookIcon,
} from "lucide-react"
import { createElement } from "react"

const docsIconComponents: Record<string, LucideIcon> = {
  BookOpenText: BookOpenTextIcon,
  Braces: BracesIcon,
  Forward: ForwardIcon,
  Gauge: GaugeIcon,
  Repeat2: Repeat2Icon,
  Search: SearchIcon,
  SlidersHorizontal: SlidersHorizontalIcon,
  Terminal: TerminalIcon,
  Webhook: WebhookIcon,
} satisfies Record<string, LucideIcon>

export const source = loader({
  baseUrl: "",
  icon(icon) {
    if (!icon) {
      return
    }

    const Icon = docsIconComponents[icon]

    if (Icon) {
      return createElement(Icon)
    }
  },
  source: docs.toFumadocsSource(),
  url(slugs) {
    return slugs.length === 0 ? "/" : `/${slugs.join("/")}`
  },
})
