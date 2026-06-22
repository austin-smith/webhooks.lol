"use client"

import * as React from "react"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { useAppTheme } from "@/components/theme/app-theme-provider"
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"

type AppearanceTheme = "system" | "light" | "dark"

const appearanceLabels: Record<AppearanceTheme, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
}

export function ThemeDropdownMenuItems({
  onNeutralThemeChange,
}: {
  onNeutralThemeChange?: () => void
}) {
  const { appTheme, setAppTheme } = useAppTheme()
  const { theme, setTheme } = useTheme()
  const neutralThemeSwitchId = React.useId()
  const appearanceTheme = normalizeAppearanceTheme(theme)
  const neutralThemeEnabled = appTheme === "neutral"

  return (
    <>
      <DropdownMenuGroup>
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
              onNeutralThemeChange?.()
            }}
            aria-label="Neutral theme"
          />
        </div>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
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
      </DropdownMenuGroup>
    </>
  )
}

function normalizeAppearanceTheme(theme: string | undefined): AppearanceTheme {
  return isAppearanceTheme(theme) ? theme : "system"
}

function isAppearanceTheme(value: unknown): value is AppearanceTheme {
  return value === "system" || value === "light" || value === "dark"
}
