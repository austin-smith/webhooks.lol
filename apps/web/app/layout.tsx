import type { Metadata } from "next"

import "./globals.css"
import { AppThemeProvider } from "@/components/theme/app-theme-provider"
import { ThemeKeyboardShortcut } from "@/components/theme/theme-keyboard-shortcut"
import { ThemeProvider } from "@/components/theme/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"

export const metadata: Metadata = {
  title: "webhooks.lol",
  description:
    "A simple webhook endpoint for receiving and inspecting requests.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="font-mono antialiased">
      <body>
        <AppThemeProvider>
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
        </AppThemeProvider>
      </body>
    </html>
  )
}
