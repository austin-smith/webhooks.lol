"use client"

import * as React from "react"
import { BookTextIcon, SaveIcon, SlidersHorizontalIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { createDocsPageUrl, CUSTOM_RESPONSE_DOCS_PATH } from "@/lib/docs-links"
import type {
  EndpointResponseConfig,
  EndpointResponseOverrideInput,
} from "@webhooks-lol/webhooks-core/endpoint-response"
import { cn } from "@/lib/utils"

type ResponseMode = EndpointResponseConfig["mode"]

const DEFAULT_RESPONSE_BODY_PREVIEW = JSON.stringify(
  {
    ok: true,
    id: "{{request.id}}",
    endpointId: "{{endpoint.id}}",
  },
  null,
  2
)

const RESPONSE_BODY_VARIABLES = [
  {
    label: "Request ID",
    value: "{{request.id}}",
  },
  {
    label: "Endpoint ID",
    value: "{{endpoint.id}}",
  },
] as const

type ResponseOverrideControlProps = {
  disabled: boolean
  docsUrl: string | null
  isSaving: boolean
  responseConfig: EndpointResponseConfig
  onReset: () => Promise<void>
  onSave: (override: EndpointResponseOverrideInput) => Promise<void>
}

export function ResponseOverrideControl({
  disabled,
  docsUrl,
  isSaving,
  onReset,
  onSave,
  responseConfig,
}: ResponseOverrideControlProps) {
  const responseDocsUrl = createDocsPageUrl(docsUrl, CUSTOM_RESPONSE_DOCS_PATH)
  const [open, setOpen] = React.useState(false)
  const [tooltipOpen, setTooltipOpen] = React.useState(false)
  const [suppressTooltip, setSuppressTooltip] = React.useState(false)
  const draftId = React.useId()
  const bodyTextareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const [status, setStatus] = React.useState("200")
  const [contentType, setContentType] = React.useState("application/json")
  const [body, setBody] = React.useState("")
  const [draftMode, setDraftMode] = React.useState<ResponseMode>("default")
  const [draftError, setDraftError] = React.useState<string | null>(null)
  const isCustom = responseConfig.mode === "custom"

  const resetDraftFields = React.useCallback(() => {
    setStatus("200")
    setContentType("application/json")
    setBody("")
  }, [])

  const loadDraft = React.useCallback(() => {
    setDraftError(null)
    setDraftMode(responseConfig.mode)

    if (responseConfig.mode === "custom") {
      setStatus(String(responseConfig.status))
      setContentType(responseConfig.contentType)
      setBody(responseConfig.body)
      return
    }

    resetDraftFields()
  }, [resetDraftFields, responseConfig])

  const updateOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setTooltipOpen(false)
        setSuppressTooltip(false)
        loadDraft()
      }

      setOpen(nextOpen)
    },
    [loadDraft]
  )

  const updateTooltipOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setTooltipOpen(false)
        return
      }

      if (!open && !suppressTooltip) {
        setTooltipOpen(true)
      }
    },
    [open, suppressTooltip]
  )

  const closeAfterSuccess = React.useCallback(() => {
    setTooltipOpen(false)
    setSuppressTooltip(true)
    setOpen(false)
  }, [])

  const selectDefaultMode = React.useCallback(() => {
    if (draftMode === "default" || isSaving) {
      return
    }

    setDraftError(null)
    setDraftMode("default")
    resetDraftFields()
  }, [draftMode, isSaving, resetDraftFields])

  const selectCustomMode = React.useCallback(() => {
    if (isSaving) {
      return
    }

    setDraftError(null)
    setDraftMode("custom")
  }, [isSaving])

  const changeDraftMode = React.useCallback(
    (nextMode: string) => {
      if (nextMode === "default") {
        selectDefaultMode()
        return
      }

      if (nextMode === "custom") {
        selectCustomMode()
      }
    },
    [selectCustomMode, selectDefaultMode]
  )

  const saveOverride = React.useCallback(async () => {
    try {
      setDraftError(null)

      if (draftMode === "default") {
        await onReset()
        closeAfterSuccess()
        return
      }

      const parsedStatus = Number(status)

      if (
        !Number.isInteger(parsedStatus) ||
        parsedStatus < 200 ||
        parsedStatus > 599
      ) {
        setDraftError("Status must be 200-599.")
        return
      }

      if (!contentType.trim()) {
        setDraftError("Content type is required.")
        return
      }

      await onSave({
        body,
        contentType: contentType.trim(),
        status: parsedStatus,
      })
      closeAfterSuccess()
    } catch {
      // The session owns the user-facing error state.
    }
  }, [body, closeAfterSuccess, contentType, draftMode, onReset, onSave, status])

  const insertBodyVariable = React.useCallback((variable: string) => {
    const textarea = bodyTextareaRef.current

    if (!textarea) {
      setBody((current) => `${current}${variable}`)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    setBody(
      (current) => `${current.slice(0, start)}${variable}${current.slice(end)}`
    )

    window.requestAnimationFrame(() => {
      textarea.focus()
      const cursor = start + variable.length
      textarea.setSelectionRange(cursor, cursor)
    })
  }, [])

  return (
    <Popover open={open} onOpenChange={updateOpen}>
      <Tooltip open={tooltipOpen} onOpenChange={updateTooltipOpen}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-sm"
              disabled={disabled}
              aria-label="Response override"
              aria-pressed={isCustom}
              onPointerLeave={() => setSuppressTooltip(false)}
            >
              <SlidersHorizontalIcon data-icon="inline-start" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Response</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        className="w-[min(92vw,26rem)] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="grid gap-3 p-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">RESPONSE</h2>
              <p className="text-[0.68rem] text-muted-foreground">
                {draftMode === "custom"
                  ? "CUSTOM OVERRIDE"
                  : "DEFAULT BEHAVIOR"}
              </p>
            </div>
            {responseDocsUrl ? (
              <a
                href={responseDocsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[0.68rem] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <BookTextIcon className="size-3.5" aria-hidden="true" />
                Learn more
              </a>
            ) : null}
          </div>

          <ToggleGroup
            type="single"
            value={draftMode}
            variant="outline"
            size="sm"
            spacing={0}
            className="grid w-full grid-cols-2"
            disabled={disabled || isSaving}
            onValueChange={changeDraftMode}
          >
            <ToggleGroupItem value="default" className="w-full rounded-sm">
              Default
            </ToggleGroupItem>
            <ToggleGroupItem value="custom" className="w-full rounded-sm">
              Custom
            </ToggleGroupItem>
          </ToggleGroup>

          {draftMode === "custom" ? (
            <>
              <ResponseFields
                body={body}
                contentType={contentType}
                disabled={isSaving}
                draftId={draftId}
                readOnly={false}
                status={status}
                onBodyChange={setBody}
                onInsertBodyVariable={insertBodyVariable}
                onContentTypeChange={setContentType}
                onStatusChange={setStatus}
                textareaRef={bodyTextareaRef}
              />

              {draftError ? (
                <div
                  role="alert"
                  className="rounded-sm border border-destructive/25 bg-destructive/10 px-2.5 py-2 text-[0.68rem] text-destructive"
                >
                  {draftError}
                </div>
              ) : null}
            </>
          ) : (
            <ResponseFields
              body={DEFAULT_RESPONSE_BODY_PREVIEW}
              contentType="application/json"
              disabled
              draftId={draftId}
              readOnly
              status="200"
              onBodyChange={setBody}
              onInsertBodyVariable={insertBodyVariable}
              onContentTypeChange={setContentType}
              onStatusChange={setStatus}
              textareaRef={bodyTextareaRef}
            />
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              size="xs"
              className="rounded-sm"
              disabled={disabled || isSaving}
              onClick={saveOverride}
            >
              <SaveIcon data-icon="inline-start" />
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function Field({
  action,
  children,
  htmlFor,
  label,
  stacked = false,
}: {
  action?: React.ReactNode
  children: React.ReactNode
  htmlFor: string
  label: string
  stacked?: boolean
}) {
  return (
    <div className={cn("grid min-w-0 gap-1", stacked && "grid-cols-1")}>
      <div className="relative flex h-7 items-center">
        <label
          htmlFor={htmlFor}
          className="text-[0.68rem] font-medium text-muted-foreground"
        >
          {label}
        </label>
        {action ? <div className="absolute right-0">{action}</div> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function ResponseFields({
  body,
  contentType,
  disabled,
  draftId,
  readOnly,
  status,
  onBodyChange,
  onInsertBodyVariable,
  onContentTypeChange,
  onStatusChange,
  textareaRef,
}: {
  body: string
  contentType: string
  disabled: boolean
  draftId: string
  readOnly: boolean
  status: string
  onBodyChange: (value: string) => void
  onInsertBodyVariable: (variable: string) => void
  onContentTypeChange: (value: string) => void
  onStatusChange: (value: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}) {
  return (
    <>
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
        <Field label="Status" htmlFor={`${draftId}-status`}>
          <Input
            id={`${draftId}-status`}
            density="compact"
            inputMode="numeric"
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
            disabled={disabled}
            readOnly={readOnly}
          />
        </Field>
        <Field label="Content-Type" htmlFor={`${draftId}-content-type`}>
          <Input
            id={`${draftId}-content-type`}
            density="compact"
            value={contentType}
            onChange={(event) => onContentTypeChange(event.target.value)}
            disabled={disabled}
            readOnly={readOnly}
          />
        </Field>
      </div>

      <Field
        label="Body"
        htmlFor={`${draftId}-body`}
        action={
          !readOnly ? (
            <BodyVariablePicker onInsert={onInsertBodyVariable} />
          ) : null
        }
        stacked
      >
        <Textarea
          id={`${draftId}-body`}
          ref={textareaRef}
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
          className="max-h-48 min-h-24 resize-y rounded-sm font-mono text-xs"
          disabled={disabled}
          readOnly={readOnly}
        />
      </Field>
    </>
  )
}

function BodyVariablePicker({
  onInsert,
}: {
  onInsert: (variable: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-5 rounded-sm px-1.5 text-[0.68rem]"
        >
          Variables
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <div className="grid gap-1">
          {RESPONSE_BODY_VARIABLES.map((variable) => (
            <button
              key={variable.value}
              type="button"
              className="grid min-w-0 gap-0.5 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              onClick={() => onInsert(variable.value)}
            >
              <span className="text-[0.68rem] font-medium">
                {variable.label}
              </span>
              <span className="truncate font-mono text-[0.68rem] text-muted-foreground">
                {variable.value}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
