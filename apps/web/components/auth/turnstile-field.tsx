"use client"

import * as React from "react"
import Script from "next/script"

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

type TurnstileRenderOptions = {
  callback: (token: string) => void
  "error-callback": () => void
  "expired-callback": () => void
  "timeout-callback": () => void
  sitekey: string
  size: "flexible"
  theme: "auto"
}

type TurnstileApi = {
  remove: (widgetId: string) => void
  render: (
    container: HTMLElement,
    options: TurnstileRenderOptions
  ) => string | undefined
  reset: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export type TurnstileFieldHandle = {
  reset: () => void
}

type TurnstileFieldProps = {
  disabled?: boolean
  onTokenChange: (token: string | null) => void
}

export const TurnstileField = React.forwardRef<
  TurnstileFieldHandle,
  TurnstileFieldProps
>(function TurnstileField({ disabled = false, onTokenChange }, ref) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const widgetIdRef = React.useRef<string | null>(null)
  const [isScriptReady, setIsScriptReady] = React.useState(false)
  const siteKey = readTurnstileSiteKey()

  const reset = React.useCallback(() => {
    const widgetId = widgetIdRef.current

    if (widgetId && window.turnstile) {
      window.turnstile.reset(widgetId)
    }

    onTokenChange(null)
  }, [onTokenChange])

  React.useImperativeHandle(ref, () => ({ reset }), [reset])

  React.useEffect(() => {
    if (window.turnstile) {
      setIsScriptReady(true)
    }
  }, [])

  React.useEffect(() => {
    if (!isScriptReady || !window.turnstile || !containerRef.current) {
      return
    }

    if (widgetIdRef.current) {
      return
    }

    const widgetId = window.turnstile.render(containerRef.current, {
      callback: onTokenChange,
      "error-callback": () => onTokenChange(null),
      "expired-callback": () => onTokenChange(null),
      "timeout-callback": () => onTokenChange(null),
      sitekey: siteKey,
      size: "flexible",
      theme: "auto",
    })

    widgetIdRef.current = widgetId ?? null

    return () => {
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId)
      }

      widgetIdRef.current = null
    }
  }, [isScriptReady, onTokenChange, siteKey])

  return (
    <div
      aria-disabled={disabled || undefined}
      className="flex min-h-16 w-full justify-center data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-60"
      data-disabled={disabled || undefined}
    >
      <Script
        src={TURNSTILE_SCRIPT_SRC}
        strategy="afterInteractive"
        onLoad={() => setIsScriptReady(true)}
      />
      <div ref={containerRef} className="w-full" />
    </div>
  )
})

function readTurnstileSiteKey() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()

  if (!siteKey) {
    throw new Error(
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY is required to use Cloudflare Turnstile."
    )
  }

  return siteKey
}
