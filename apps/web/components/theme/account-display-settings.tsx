"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import { useAppTheme } from "@/components/theme/app-theme-provider"
import { useHydratedThemeOption } from "@/components/theme/use-hydrated-theme-option"
import { useSyntaxTheme } from "@/components/theme/use-syntax-theme"
import { SyntaxThemePreview } from "@/components/theme/syntax-theme-preview"
import {
  APPEARANCE_OPTIONS,
  THEME_OPTIONS,
  isAppearanceOption,
  isThemeOption,
} from "@/components/theme/display-options"
import {
  DEFAULT_SYNTAX_THEME,
  SYNTAX_THEME_OPTIONS,
  getSyntaxThemeLabel,
  isSyntaxThemeOption,
} from "@/components/theme/syntax-theme"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export function AccountDisplaySettings() {
  const { appTheme, setAppTheme } = useAppTheme()
  const { theme, setTheme } = useTheme()
  const { syntaxTheme, setSyntaxTheme } = useSyntaxTheme()
  const appearanceLabelId = React.useId()
  const themeLabelId = React.useId()
  const syntaxThemeLabelId = React.useId()
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
        <div className="flex flex-col gap-2">
          <div
            id={syntaxThemeLabelId}
            className="text-[0.68rem] tracking-wide text-muted-foreground uppercase"
          >
            Syntax theme
          </div>
          <Select
            value={syntaxTheme}
            onValueChange={(value) => {
              if (isSyntaxThemeOption(value)) {
                setSyntaxTheme(value)
              }
            }}
          >
            <SelectTrigger
              size="sm"
              aria-labelledby={syntaxThemeLabelId}
              className="w-full rounded-sm text-xs"
            >
              <SelectValue aria-label={getSyntaxThemeLabel(syntaxTheme)}>
                {getSyntaxThemeLabel(syntaxTheme)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectGroup>
                {SYNTAX_THEME_OPTIONS.map((syntaxThemeOption) => (
                  <SelectItem
                    key={syntaxThemeOption.value}
                    value={syntaxThemeOption.value}
                    className={
                      syntaxThemeOption.value === DEFAULT_SYNTAX_THEME
                        ? "pr-20 text-xs"
                        : "text-xs"
                    }
                  >
                    <span className="flex w-full min-w-0 items-center justify-between gap-3">
                      <span className="truncate">
                        {syntaxThemeOption.label}
                      </span>
                      {syntaxThemeOption.value === DEFAULT_SYNTAX_THEME ? (
                        <Badge
                          variant="outline"
                          className="h-4 shrink-0 px-1 text-[0.58rem] tracking-wide"
                        >
                          DEFAULT
                        </Badge>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <SyntaxThemePreview syntaxTheme={syntaxTheme} />
        </div>
      </div>
    </section>
  )
}
