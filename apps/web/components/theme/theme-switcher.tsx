"use client"

import * as React from "react"
import { MoonIcon, MoreHorizontalIcon, SunIcon } from "lucide-react"

import { ThemeDropdownMenuItems } from "@/components/theme/theme-dropdown-menu-items"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type ThemeSwitcherProps = {
  trigger?: "theme" | "preferences"
}

export function ThemeSwitcher({ trigger = "theme" }: ThemeSwitcherProps) {
  const [open, setOpen] = React.useState(false)
  const isPreferencesTrigger = trigger === "preferences"

  const changeMenuOpen = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
  }, [])

  return (
    <DropdownMenu open={open} onOpenChange={changeMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={isPreferencesTrigger ? "Preferences" : "Theme"}
        >
          {isPreferencesTrigger ? (
            <MoreHorizontalIcon data-icon="inline-start" />
          ) : (
            <>
              <SunIcon data-icon="inline-start" className="dark:hidden" />
              <MoonIcon
                data-icon="inline-start"
                className="hidden dark:block"
              />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <ThemeDropdownMenuItems
          onNeutralThemeChange={() => {
            changeMenuOpen(false)
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
