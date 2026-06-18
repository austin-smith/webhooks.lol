"use client"

import * as React from "react"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { useAppTheme } from "@/components/theme/app-theme-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"

type AppearanceTheme = "system" | "light" | "dark"

const appearanceLabels: Record<AppearanceTheme, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
}

export function ThemeSwitcher() {
  const { appTheme, setAppTheme } = useAppTheme()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = React.useState(false)
  const neutralThemeSwitchId = React.useId()
  const appearanceTheme = normalizeAppearanceTheme(theme)
  const neutralThemeEnabled = appTheme === "neutral"

  const changeMenuOpen = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
  }, [])

  return (
    <DropdownMenu open={open} onOpenChange={changeMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Theme"
          className="h-7 rounded-md px-2 text-[0.68rem] tracking-wide text-muted-foreground hover:text-foreground"
        >
          <SunIcon data-icon="inline-start" className="dark:hidden" />
          <MoonIcon data-icon="inline-start" className="hidden dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <div className="flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-xs">
          <label htmlFor={neutralThemeSwitchId} className="cursor-pointer">
            Neutral
          </label>
          <Switch
            id={neutralThemeSwitchId}
            size="sm"
            checked={neutralThemeEnabled}
            onCheckedChange={(checked) => {
              setAppTheme(checked ? "neutral" : "branded")
              changeMenuOpen(false)
            }}
            aria-label="Neutral theme"
          />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={appearanceTheme}
          onValueChange={(value) => {
            if (isAppearanceTheme(value)) {
              setTheme(value)
            }
          }}
        >
          <DropdownMenuRadioItem value="system">
            <MonitorIcon data-icon="inline-start" />
            {appearanceLabels.system}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <SunIcon data-icon="inline-start" />
            {appearanceLabels.light}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <MoonIcon data-icon="inline-start" />
            {appearanceLabels.dark}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function normalizeAppearanceTheme(theme: string | undefined): AppearanceTheme {
  return isAppearanceTheme(theme) ? theme : "system"
}

function isAppearanceTheme(value: unknown): value is AppearanceTheme {
  return value === "system" || value === "light" || value === "dark"
}
