import type { Metadata } from "next"

import "./globals.css"
import { ThemeKeyboardShortcut } from "@/components/theme/theme-keyboard-shortcut"
import { ThemeProvider } from "@/components/theme/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"

export const metadata: Metadata = {
  title: "webhooks.lol",
  description: "A simple webhook inbox for receiving and inspecting requests.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="font-mono antialiased">
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="webhooks.lol:theme"
        >
          <ThemeKeyboardShortcut />
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
