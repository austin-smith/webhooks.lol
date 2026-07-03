"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  BookTextIcon,
  CheckIcon,
  ChevronRightIcon,
  LogOutIcon,
  MenuIcon,
  SettingsIcon,
} from "lucide-react"

import { AccountMenuIdentity } from "@/components/auth/account-menu-identity"
import { GithubIcon } from "@/components/icons/github-icon"
import { useAppTheme } from "@/components/theme/app-theme-provider"
import { useTheme } from "@/components/theme/theme-provider"
import {
  APPEARANCE,
  THEME_OPTIONS,
  type ThemeIcon,
  type ThemeOption,
  getThemeLabel,
} from "@/components/theme/display-options"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { authClient } from "@/lib/auth/client"
import { cn } from "@/lib/utils"
import type { AppHeaderUser } from "./app-header"

const GITHUB_URL = "https://github.com/austin-smith/webhooks.lol"

type AppHeaderMenuProps = {
  docsUrl: string | null
  user: AppHeaderUser | null
}

type MenuView = "main" | "theme"

export function AppHeaderMenu({ docsUrl, user }: AppHeaderMenuProps) {
  const router = useRouter()
  const { appTheme, setAppTheme } = useAppTheme()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = React.useState(false)
  const [menuView, setMenuView] = React.useState<MenuView>("main")
  const [isSigningOut, setIsSigningOut] = React.useState(false)
  const neutralThemeEnabled = appTheme === APPEARANCE.NEUTRAL.value
  const neutralSwitchId = React.useId()

  async function signOut() {
    setIsSigningOut(true)

    try {
      await authClient.signOut()
      router.replace("/")
      router.refresh()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)

        if (!nextOpen) {
          setMenuView("main")
        }
      }}
    >
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Open menu"
        >
          <MenuIcon data-icon="inline-start" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[min(22rem,calc(100vw-2rem))] gap-0 p-0"
      >
        {menuView === "theme" ? (
          <SheetHeader className="border-b pr-12">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Back to menu"
                onClick={() => {
                  setMenuView("main")
                }}
              >
                <ArrowLeftIcon data-icon="inline-start" />
              </Button>
              <SheetTitle>Theme</SheetTitle>
            </div>
            <SheetDescription className="sr-only">
              Choose the app theme
            </SheetDescription>
          </SheetHeader>
        ) : (
          <SheetHeader className="border-b pr-12">
            <SheetTitle className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="flex size-5 shrink-0 items-center justify-center">
                <Image
                  src="/icon.png"
                  alt=""
                  width={20}
                  height={20}
                  aria-hidden="true"
                  className="size-5"
                  priority
                />
              </span>
              <span className="truncate">
                WEBHOOKS<span className="text-brand">.LOL</span>
              </span>
            </SheetTitle>
            <SheetDescription className="sr-only">
              App navigation and settings
            </SheetDescription>
          </SheetHeader>
        )}
        {menuView === "theme" ? (
          <ThemeMenuView
            currentTheme={theme}
            onThemeChange={(nextTheme) => {
              setTheme(nextTheme)
              setMenuView("main")
            }}
          />
        ) : (
          <>
            <div className="flex flex-1 flex-col gap-2 p-2">
              {user ? (
                <>
                  <AccountMenuIdentity user={user} />
                  <SheetClose asChild>
                    <Link
                      href="/account"
                      className={cn(
                        mobileMenuActionClassName,
                        "flex items-center gap-2"
                      )}
                    >
                      <SettingsIcon aria-hidden="true" />
                      Account Settings
                    </Link>
                  </SheetClose>
                </>
              ) : null}
              <Separator />
              <div className="flex flex-col gap-1">
                <MobileMenuLabel>Appearance</MobileMenuLabel>
                <label
                  htmlFor={neutralSwitchId}
                  className="flex items-center justify-between gap-3 rounded-sm px-2 py-2 text-xs hover:bg-accent hover:text-accent-foreground"
                >
                  <span>{APPEARANCE.NEUTRAL.label}</span>
                  <Switch
                    id={neutralSwitchId}
                    size="sm"
                    checked={neutralThemeEnabled}
                    onCheckedChange={(checked) => {
                      setAppTheme(
                        checked
                          ? APPEARANCE.NEUTRAL.value
                          : APPEARANCE.BRANDED.value
                      )
                    }}
                    aria-label="Neutral appearance"
                  />
                </label>
              </div>
              <Separator />
              <div className="flex flex-col gap-1">
                <MobileMenuLabel>Theme</MobileMenuLabel>
                <button
                  type="button"
                  className={cn(
                    mobileMenuActionClassName,
                    "flex items-center justify-between gap-3 text-left"
                  )}
                  aria-label={`Theme, ${getThemeLabel(theme)}`}
                  onClick={() => {
                    setMenuView("theme")
                  }}
                >
                  <span>Theme</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span>{getThemeLabel(theme)}</span>
                    <ChevronRightIcon aria-hidden="true" />
                  </span>
                </button>
              </div>
              <Separator />
              <div className="flex flex-col gap-1">
                <MobileMenuLabel>Resources</MobileMenuLabel>
                {docsUrl ? (
                  <SheetClose asChild>
                    <MobileMenuAnchor href={docsUrl} icon={BookTextIcon}>
                      Docs
                    </MobileMenuAnchor>
                  </SheetClose>
                ) : null}
                <SheetClose asChild>
                  <MobileMenuAnchor href={GITHUB_URL} icon={GithubIcon}>
                    GitHub
                  </MobileMenuAnchor>
                </SheetClose>
              </div>
            </div>
            <SheetFooter className="border-t">
              {user ? (
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    className={cn(
                      mobileMenuActionClassName,
                      "flex items-center gap-2 text-left text-muted-foreground"
                    )}
                    disabled={isSigningOut}
                    onClick={() => {
                      void signOut()
                    }}
                  >
                    <LogOutIcon aria-hidden="true" />
                    <span>Sign out</span>
                  </button>
                </div>
              ) : (
                <SheetClose asChild>
                  <Button asChild>
                    <Link href="/login">Sign in</Link>
                  </Button>
                </SheetClose>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function ThemeMenuView({
  currentTheme,
  onThemeChange,
}: {
  currentTheme: ThemeOption
  onThemeChange: (theme: ThemeOption) => void
}) {
  return (
    <div className="flex flex-1 flex-col gap-1 p-2">
      {THEME_OPTIONS.map((themeOption) => (
        <ThemeMenuItem
          key={themeOption.value}
          value={themeOption.value}
          selected={currentTheme === themeOption.value}
          icon={themeOption.icon}
          onSelect={onThemeChange}
        />
      ))}
    </div>
  )
}

function ThemeMenuItem({
  value,
  selected,
  icon: Icon,
  onSelect,
}: {
  value: ThemeOption
  selected: boolean
  icon: ThemeIcon
  onSelect: (theme: ThemeOption) => void
}) {
  const label = getThemeLabel(value)

  return (
    <button
      type="button"
      className={cn(
        mobileMenuActionClassName,
        "flex items-center justify-between gap-3 text-left",
        selected && "bg-accent text-accent-foreground"
      )}
      aria-pressed={selected}
      onClick={() => {
        onSelect(value)
      }}
    >
      <span className="flex items-center gap-2">
        <Icon aria-hidden="true" />
        <span>{label}</span>
      </span>
      {selected ? <CheckIcon aria-hidden="true" /> : null}
    </button>
  )
}

function MobileMenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-1 text-[0.68rem] text-muted-foreground">
      {children}
    </div>
  )
}

const mobileMenuActionClassName =
  "rounded-sm px-2 py-2 text-xs outline-hidden hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5"

const MobileMenuAnchor = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<"a"> & {
    icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  }
>(function MobileMenuAnchor(
  { children, className, icon: Icon, ...props },
  ref
) {
  return (
    <a
      ref={ref}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        mobileMenuActionClassName,
        "flex items-center gap-2",
        className
      )}
      {...props}
    >
      {Icon ? <Icon aria-hidden="true" /> : null}
      <span>{children}</span>
    </a>
  )
})
