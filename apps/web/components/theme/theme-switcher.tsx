"use client"

import * as React from "react"
import { MoonIcon, SunIcon } from "lucide-react"

import { ThemeDropdownMenuItems } from "@/components/theme/theme-dropdown-menu-items"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeSwitcher() {
  const [open, setOpen] = React.useState(false)

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
        <ThemeDropdownMenuItems
          onNeutralThemeChange={() => {
            changeMenuOpen(false)
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
