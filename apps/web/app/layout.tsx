import type { Metadata } from "next"

import "./globals.css"
import { AppThemeProvider } from "@/components/theme/app-theme-provider"
import {
  ThemeBootstrapScript,
  readDisplayPreferences,
} from "@/components/theme/display-preferences"
import { SyntaxThemeProvider } from "@/components/theme/syntax-theme-provider"
import { ThemeKeyboardShortcut } from "@/components/theme/theme-keyboard-shortcut"
import { ThemeProvider } from "@/components/theme/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { readAppUrl } from "@/lib/app-urls"

export const metadata: Metadata = {
  metadataBase: readAppUrl(),
  title: "webhooks.lol",
  description:
    "A simple webhook endpoint for receiving and inspecting requests.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { appTheme, syntaxTheme, theme } = await readDisplayPreferences()

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-app-theme={appTheme}
      className="font-mono antialiased"
    >
      <body>
        <ThemeBootstrapScript theme={theme} />
        <AppThemeProvider initialAppTheme={appTheme}>
          <ThemeProvider initialTheme={theme}>
            <SyntaxThemeProvider initialSyntaxTheme={syntaxTheme}>
              <ThemeKeyboardShortcut />
              <TooltipProvider>{children}</TooltipProvider>
            </SyntaxThemeProvider>
          </ThemeProvider>
        </AppThemeProvider>
      </body>
    </html>
  )
}
