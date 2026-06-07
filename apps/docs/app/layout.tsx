import type { Metadata } from "next"
import type { ReactNode } from "react"
import { RootProvider } from "fumadocs-ui/provider/next"

import "./global.css"

export const metadata: Metadata = {
  metadataBase: new URL("https://docs.webhooks.lol"),
  title: {
    default: "webhooks.lol docs",
    template: "%s | webhooks.lol docs",
  },
  description:
    "Documentation for creating webhook endpoints, receiving requests, inspecting captured traffic, and configuring responses with webhooks.lol.",
  applicationName: "webhooks.lol docs",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "webhooks.lol docs",
    description:
      "Documentation for creating webhook endpoints, receiving requests, inspecting captured traffic, and configuring responses with webhooks.lol.",
    siteName: "webhooks.lol docs",
    url: "https://docs.webhooks.lol",
    type: "website",
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
