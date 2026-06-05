import type { Metadata } from "next"
import Script from "next/script"

import "./globals.css"
import { ThemeKeyboardShortcut } from "@/components/theme-keyboard-shortcut"
import { TooltipProvider } from "@/components/ui/tooltip"
import { THEME_STORAGE_KEY } from "@/lib/theme"

export const metadata: Metadata = {
  title: "webhooks.lol",
  description: "A simple webhook inbox for receiving and inspecting requests.",
}

const themeInitScript = `
(() => {
  try {
    const storedTheme = window.localStorage.getItem("${THEME_STORAGE_KEY}")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const useDarkTheme = storedTheme === "dark" || (storedTheme !== "light" && prefersDark)

    document.documentElement.classList.toggle("dark", useDarkTheme)
  } catch {
  }
})()
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="font-mono antialiased">
      <body>
        <Script id="webhooks-lol-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <ThemeKeyboardShortcut />
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
