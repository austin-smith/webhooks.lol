"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import { useAppTheme } from "@/components/theme/app-theme-provider"
import { useHydratedThemeOption } from "@/components/theme/use-hydrated-theme-option"
import {
  APPEARANCE_OPTIONS,
  THEME_OPTIONS,
  isAppearanceOption,
  isThemeOption,
} from "@/components/theme/display-options"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export function AccountDisplaySettings() {
  const { appTheme, setAppTheme } = useAppTheme()
  const { theme, setTheme } = useTheme()
  const appearanceLabelId = React.useId()
  const themeLabelId = React.useId()
  const currentTheme = useHydratedThemeOption(theme)

  return (
    <section className="flex flex-col gap-3 rounded-md border bg-card p-3">
      <h2 className="font-heading text-sm">Display</h2>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div
            id={appearanceLabelId}
            className="text-[0.68rem] tracking-wide text-muted-foreground uppercase"
          >
            Appearance
          </div>
          <ToggleGroup
            type="single"
            value={appTheme}
            variant="outline"
            size="sm"
            spacing={0}
            aria-labelledby={appearanceLabelId}
            className="grid w-full grid-cols-2"
            onValueChange={(value) => {
              if (isAppearanceOption(value)) {
                setAppTheme(value)
              }
            }}
          >
            {APPEARANCE_OPTIONS.map((appearance) => (
              <ToggleGroupItem
                key={appearance.value}
                value={appearance.value}
                className="w-full rounded-sm text-xs"
              >
                {appearance.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex flex-col gap-2">
          <div
            id={themeLabelId}
            className="text-[0.68rem] tracking-wide text-muted-foreground uppercase"
          >
            Theme
          </div>
          <ToggleGroup
            type="single"
            value={currentTheme}
            variant="outline"
            size="sm"
            spacing={0}
            aria-labelledby={themeLabelId}
            className="grid w-full grid-cols-3"
            onValueChange={(value) => {
              if (isThemeOption(value)) {
                setTheme(value)
              }
            }}
          >
            {THEME_OPTIONS.map((themeOption) => {
              const Icon = themeOption.icon

              return (
                <ToggleGroupItem
                  key={themeOption.value}
                  value={themeOption.value}
                  className="w-full rounded-sm text-xs"
                >
                  <Icon data-icon="inline-start" />
                  {themeOption.label}
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>
        </div>
      </div>
    </section>
  )
}
