import * as React from "react"

import type { CapturedRequest } from "@webhooks-lol/webhooks-core/types"

import {
  formatRequestAsCliCommand,
  formatRequestAsCurl,
  formatRequestAsFetch,
  type RequestCopyFormat,
} from "./request-copy-formatters"

const COPY_STATUS_RESET_MS = 1400

export function useRequestCopyAction({
  request,
  webhookUrl,
}: {
  request: CapturedRequest
  webhookUrl: string
}) {
  const [copiedFormat, setCopiedFormat] =
    React.useState<RequestCopyFormat | null>(null)
  const [statusMessage, setStatusMessage] = React.useState("")
  const resetTimeout = React.useRef<number | null>(null)
  const canCopy = Boolean(webhookUrl)

  React.useEffect(() => {
    return () => {
      if (resetTimeout.current) {
        window.clearTimeout(resetTimeout.current)
      }
    }
  }, [])

  const copyFormat = React.useCallback(
    async (format: RequestCopyFormat) => {
      if (!webhookUrl) {
        return
      }

      const value = formatRequestCopyValue({ format, request, webhookUrl })

      if (resetTimeout.current) {
        window.clearTimeout(resetTimeout.current)
      }

      try {
        await navigator.clipboard.writeText(value)
        setCopiedFormat(format)
        setStatusMessage(formatRequestCopyStatus(format))
      } catch {
        setCopiedFormat(null)
        setStatusMessage("Could not copy request")
      }

      resetTimeout.current = window.setTimeout(() => {
        setCopiedFormat((current) => (current === format ? null : current))
        setStatusMessage("")
        resetTimeout.current = null
      }, COPY_STATUS_RESET_MS)
    },
    [request, webhookUrl]
  )

  return {
    canCopy,
    copiedFormat,
    copyFormat,
    statusMessage,
  }
}

function formatRequestCopyValue({
  format,
  request,
  webhookUrl,
}: {
  format: RequestCopyFormat
  request: CapturedRequest
  webhookUrl: string
}) {
  switch (format) {
    case "cli":
      return formatRequestAsCliCommand({ request })
    case "curl":
      return formatRequestAsCurl({ request, webhookUrl })
    case "fetch":
      return formatRequestAsFetch({ request, webhookUrl })
  }
}

function formatRequestCopyStatus(format: RequestCopyFormat) {
  switch (format) {
    case "cli":
      return "Copied CLI command"
    case "curl":
      return "Copied cURL command"
    case "fetch":
      return "Copied fetch snippet"
  }
}
