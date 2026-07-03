"use client"

import * as React from "react"
import { MoreHorizontalIcon } from "lucide-react"

import { useAppTheme } from "@/components/theme/app-theme-provider"
import { useTheme } from "@/components/theme/theme-provider"
import {
  APPEARANCE,
  THEME_OPTIONS,
  isThemeOption,
} from "@/components/theme/display-options"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"

export function DisplayDropdownMenu() {
  const [open, setOpen] = React.useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Display settings"
        >
          <MoreHorizontalIcon data-icon="inline-start" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DisplayDropdownMenuItems
          onNeutralAppearanceChange={() => {
            setOpen(false)
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function DisplayDropdownMenuItems({
  onNeutralAppearanceChange,
}: {
  onNeutralAppearanceChange?: () => void
}) {
  const { appTheme, setAppTheme } = useAppTheme()
  const { theme, setTheme } = useTheme()
  const neutralAppearanceSwitchId = React.useId()
  const neutralAppearanceEnabled = appTheme === APPEARANCE.NEUTRAL.value

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <div className="flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-xs">
          <label htmlFor={neutralAppearanceSwitchId} className="cursor-pointer">
            {APPEARANCE.NEUTRAL.label}
          </label>
          <Switch
            id={neutralAppearanceSwitchId}
            size="sm"
            checked={neutralAppearanceEnabled}
            onCheckedChange={(checked) => {
              setAppTheme(
                checked ? APPEARANCE.NEUTRAL.value : APPEARANCE.BRANDED.value
              )
              onNeutralAppearanceChange?.()
            }}
            aria-label="Neutral appearance"
          />
        </div>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => {
            if (isThemeOption(value)) {
              setTheme(value)
            }
          }}
        >
          {THEME_OPTIONS.map((themeOption) => {
            const Icon = themeOption.icon

            return (
              <DropdownMenuRadioItem
                key={themeOption.value}
                value={themeOption.value}
              >
                <Icon data-icon="inline-start" />
                {themeOption.label}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
    </>
  )
}
