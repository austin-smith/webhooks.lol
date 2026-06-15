"use client"

import * as React from "react"
import {
  BookTextIcon,
  CheckIcon,
  CircleHelpIcon,
  ForwardIcon,
  LoaderCircleIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { createDocsPageUrl, FORWARDING_DOCS_PATH } from "@/lib/docs-links"
import { cn } from "@/lib/utils"

import type { EndpointForwardTarget } from "./endpoint-session/transport"
import type { EndpointForwardPathMode } from "./types"

type EndpointForwardingControlProps = {
  disabled: boolean
  docsUrl: string | null
  isLoading: boolean
  isSaving: boolean
  targets: EndpointForwardTarget[]
  onCreateTarget: (target: {
    pathMode?: EndpointForwardPathMode
    url: string
  }) => Promise<void>
  onDeleteTarget: (targetId: string) => Promise<void>
  onLoadTargets: () => Promise<void>
  onUpdateTarget: (
    targetId: string,
    target: {
      enabled?: boolean
      pathMode?: EndpointForwardPathMode
      url?: string
    }
  ) => Promise<void>
}

export function EndpointForwardingControl({
  disabled,
  docsUrl,
  isLoading,
  isSaving,
  onCreateTarget,
  onDeleteTarget,
  onLoadTargets,
  onUpdateTarget,
  targets,
}: EndpointForwardingControlProps) {
  const forwardingDocsUrl = createDocsPageUrl(docsUrl, FORWARDING_DOCS_PATH)
  const [open, setOpen] = React.useState(false)
  const [tooltipOpen, setTooltipOpen] = React.useState(false)
  const [editingTargetId, setEditingTargetId] = React.useState<string | null>(
    null
  )
  const [confirmingDeleteTargetId, setConfirmingDeleteTargetId] =
    React.useState<string | null>(null)
  const [isAdding, setIsAdding] = React.useState(false)
  const [url, setUrl] = React.useState("")
  const [pathMode, setPathMode] =
    React.useState<EndpointForwardPathMode>("strip")
  const [draftError, setDraftError] = React.useState<string | null>(null)
  const enabledCount = targets.filter((target) => target.enabled).length
  const editingTarget = editingTargetId
    ? targets.find((target) => target.id === editingTargetId)
    : null
  const titleId = React.useId()

  const resetDraft = React.useCallback(() => {
    setEditingTargetId(null)
    setConfirmingDeleteTargetId(null)
    setIsAdding(false)
    setUrl("")
    setPathMode("strip")
    setDraftError(null)
  }, [])

  const startAdding = React.useCallback(() => {
    setEditingTargetId(null)
    setConfirmingDeleteTargetId(null)
    setUrl("")
    setPathMode("strip")
    setDraftError(null)
    setIsAdding(true)
  }, [])

  const updateOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setTooltipOpen(false)
        void onLoadTargets().catch(() => undefined)
      } else {
        resetDraft()
      }

      setOpen(nextOpen)
    },
    [onLoadTargets, resetDraft]
  )

  const updateTooltipOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setTooltipOpen(false)
        return
      }

      if (!open) {
        setTooltipOpen(true)
      }
    },
    [open]
  )

  const editTarget = React.useCallback((target: EndpointForwardTarget) => {
    setEditingTargetId(target.id)
    setConfirmingDeleteTargetId(null)
    setIsAdding(false)
    setUrl(target.url)
    setPathMode(target.pathMode)
    setDraftError(null)
  }, [])

  const saveTarget = React.useCallback(async () => {
    const normalizedUrl = url.trim()

    if (!normalizedUrl) {
      setDraftError("Forward URL is required.")
      return
    }

    setDraftError(null)

    try {
      if (editingTarget) {
        await onUpdateTarget(editingTarget.id, {
          pathMode,
          url: normalizedUrl,
        })
      } else {
        await onCreateTarget({
          pathMode,
          url: normalizedUrl,
        })
      }

      resetDraft()
    } catch (error) {
      setDraftError(readErrorMessage(error))
    }
  }, [editingTarget, onCreateTarget, onUpdateTarget, pathMode, resetDraft, url])

  const toggleTargetEnabled = React.useCallback(
    async (target: EndpointForwardTarget) => {
      setDraftError(null)
      setConfirmingDeleteTargetId(null)

      try {
        await onUpdateTarget(target.id, {
          enabled: !target.enabled,
        })
      } catch (error) {
        setDraftError(readErrorMessage(error))
      }
    },
    [onUpdateTarget]
  )

  const requestDeleteTarget = React.useCallback(
    (target: EndpointForwardTarget) => {
      setEditingTargetId(null)
      setIsAdding(false)
      setConfirmingDeleteTargetId(target.id)
      setDraftError(null)
    },
    []
  )

  const cancelDeleteTarget = React.useCallback(() => {
    setConfirmingDeleteTargetId(null)
  }, [])

  const deleteTarget = React.useCallback(
    async (target: EndpointForwardTarget) => {
      setDraftError(null)

      try {
        await onDeleteTarget(target.id)
        resetDraft()
      } catch (error) {
        setDraftError(readErrorMessage(error))
      }
    },
    [onDeleteTarget, resetDraft]
  )

  const showEmpty = targets.length === 0 && !isAdding && !isLoading
  const showAddButton = !isAdding

  return (
    <Popover open={open} onOpenChange={updateOpen}>
      <Tooltip open={tooltipOpen} onOpenChange={updateTooltipOpen}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="relative rounded-sm"
              disabled={disabled}
              aria-label="Forwarding"
              aria-pressed={enabledCount > 0}
            >
              <ForwardIcon data-icon="inline-start" />
              {enabledCount > 0 ? (
                <Badge
                  variant="secondary"
                  className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full border border-card px-1 text-[0.6rem] tabular-nums"
                >
                  {enabledCount}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Forwarding</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        aria-labelledby={titleId}
        className="w-[min(92vw,26rem)] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="grid gap-3 p-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-sm font-semibold">
                FORWARDING
              </h2>
              <p className="text-[0.68rem] text-muted-foreground">
                {enabledCount} active / {targets.length} configured
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              {isLoading ? (
                <div
                  role="status"
                  className="inline-flex h-6 items-center gap-1.5 text-[0.68rem] text-muted-foreground"
                >
                  <LoaderCircleIcon
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                  Loading
                </div>
              ) : null}
              {forwardingDocsUrl ? (
                <a
                  href={forwardingDocsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[0.68rem] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  <BookTextIcon className="size-3.5" aria-hidden="true" />
                  Learn more
                </a>
              ) : null}
            </div>
          </div>

          {showEmpty ? (
            <Empty className="h-28 rounded-sm border border-dashed bg-background/60 p-4">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="rounded-sm">
                  <ForwardIcon />
                </EmptyMedia>
                <EmptyTitle>NO TARGETS</EmptyTitle>
                <EmptyDescription className="text-xs">
                  Add an HTTPS URL to forward requests.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ScrollArea className="max-h-72 min-h-0">
              <ul aria-label="Forward targets" className="flex flex-col gap-2">
                {targets.map((target) => (
                  <ForwardTargetRow
                    key={target.id}
                    confirmingDelete={confirmingDeleteTargetId === target.id}
                    disabled={disabled || isSaving}
                    draftError={draftError}
                    editing={editingTargetId === target.id}
                    isSaving={isSaving}
                    pathMode={pathMode}
                    target={target}
                    url={url}
                    onCancelDelete={cancelDeleteTarget}
                    onCancelEdit={resetDraft}
                    onConfirmDelete={() => deleteTarget(target)}
                    onEdit={() => editTarget(target)}
                    onPathModeChange={setPathMode}
                    onRequestDelete={() => requestDeleteTarget(target)}
                    onSaveEdit={saveTarget}
                    onToggleEnabled={() => toggleTargetEnabled(target)}
                    onUrlChange={setUrl}
                  />
                ))}
                {isAdding ? (
                  <AddTargetRow
                    draftError={draftError}
                    isSaving={isSaving}
                    pathMode={pathMode}
                    url={url}
                    onCancel={resetDraft}
                    onPathModeChange={setPathMode}
                    onSave={saveTarget}
                    onUrlChange={setUrl}
                  />
                ) : null}
              </ul>
            </ScrollArea>
          )}

          {showAddButton ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full rounded-sm"
              disabled={disabled || isSaving}
              onClick={startAdding}
            >
              <PlusIcon data-icon="inline-start" />
              Add target
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ForwardTargetEditor({
  draftError,
  editing,
  isSaving,
  onCancel,
  onPathModeChange,
  onSave,
  onUrlChange,
  pathMode,
  url,
}: {
  draftError: string | null
  editing: boolean
  isSaving: boolean
  pathMode: EndpointForwardPathMode
  url: string
  onCancel: () => void
  onPathModeChange: (pathMode: EndpointForwardPathMode) => void
  onSave: () => void
  onUrlChange: (url: string) => void
}) {
  return (
    <div className="grid min-w-0 gap-2.5 rounded-sm border bg-background px-2.5 py-2.5">
      <Textarea
        aria-label="Forward URL"
        placeholder="https://example.com/webhook"
        value={url}
        disabled={isSaving}
        aria-invalid={Boolean(draftError)}
        spellCheck={false}
        autoCapitalize="none"
        autoComplete="url"
        className="max-h-28 min-h-14 resize-y rounded-sm px-2 py-1 font-mono text-xs leading-snug break-all whitespace-normal md:text-xs"
        onChange={(event) =>
          onUrlChange(event.currentTarget.value.replace(/[\r\n]+/g, ""))
        }
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
          }
        }}
      />

      <div className="flex min-w-0 items-center gap-1.5">
        <label className="flex min-w-0 items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="size-3.5 shrink-0 accent-foreground"
            checked={pathMode === "preserve"}
            disabled={isSaving}
            onChange={(event) =>
              onPathModeChange(event.target.checked ? "preserve" : "strip")
            }
          />
          Append incoming request path
        </label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="What does appending the path do?"
              className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <CircleHelpIcon className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-60">
            <span className="leading-snug">
              Appends the request path (e.g.{" "}
              <span className="font-mono">/events/created</span>) onto the
              target URL.
            </span>
          </TooltipContent>
        </Tooltip>
      </div>

      {draftError ? (
        <div
          role="alert"
          className="rounded-sm border border-destructive/25 bg-destructive/10 px-2.5 py-2 text-[0.68rem] text-destructive"
        >
          {draftError}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="rounded-sm"
          disabled={isSaving}
          onClick={onCancel}
        >
          <XIcon data-icon="inline-start" />
          Cancel
        </Button>
        <Button
          type="button"
          size="xs"
          className="rounded-sm"
          disabled={isSaving}
          onClick={onSave}
        >
          {isSaving ? (
            <LoaderCircleIcon
              data-icon="inline-start"
              className="animate-spin"
            />
          ) : editing ? (
            <SaveIcon data-icon="inline-start" />
          ) : (
            <PlusIcon data-icon="inline-start" />
          )}
          {editing ? "Save" : "Add"}
        </Button>
      </div>
    </div>
  )
}

function ForwardTargetItem({
  confirmingDelete,
  disabled,
  onCancelDelete,
  onConfirmDelete,
  onEdit,
  onRequestDelete,
  onToggleEnabled,
  target,
}: {
  confirmingDelete: boolean
  disabled: boolean
  target: EndpointForwardTarget
  onCancelDelete: () => void
  onConfirmDelete: () => void
  onEdit: () => void
  onRequestDelete: () => void
  onToggleEnabled: () => void
}) {
  return (
    <div className="grid min-w-0 gap-2 rounded-sm border bg-background px-2.5 py-2">
      <div className="flex min-w-0">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-xs leading-snug font-medium break-all whitespace-normal",
              !target.enabled && "text-muted-foreground"
            )}
          >
            {target.url}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.68rem] font-medium text-muted-foreground">
          {target.enabled ? "Enabled" : "Disabled"}
        </span>
        {confirmingDelete ? (
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-[0.68rem] text-destructive">Delete?</span>
            <Button
              type="button"
              variant="destructive"
              size="icon-xs"
              className="rounded-sm"
              disabled={disabled}
              aria-label="Confirm delete forward target"
              onClick={onConfirmDelete}
            >
              <CheckIcon data-icon="inline-start" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="rounded-sm"
              disabled={disabled}
              aria-label="Cancel delete forward target"
              onClick={onCancelDelete}
            >
              <XIcon data-icon="inline-start" />
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="rounded-sm"
                  disabled={disabled}
                  aria-label="Edit forward target"
                  onClick={onEdit}
                >
                  <PencilIcon data-icon="inline-start" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="rounded-sm"
                  disabled={disabled}
                  aria-label={
                    target.enabled
                      ? "Disable forward target"
                      : "Enable forward target"
                  }
                  onClick={onToggleEnabled}
                >
                  {target.enabled ? (
                    <PauseIcon data-icon="inline-start" />
                  ) : (
                    <PlayIcon data-icon="inline-start" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {target.enabled ? "Disable" : "Enable"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="rounded-sm text-destructive hover:text-destructive"
                  disabled={disabled}
                  aria-label="Delete forward target"
                  onClick={onRequestDelete}
                >
                  <Trash2Icon data-icon="inline-start" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}

function ForwardTargetRow({
  confirmingDelete,
  disabled,
  draftError,
  editing,
  isSaving,
  onCancelDelete,
  onCancelEdit,
  onConfirmDelete,
  onEdit,
  onPathModeChange,
  onRequestDelete,
  onSaveEdit,
  onToggleEnabled,
  onUrlChange,
  pathMode,
  target,
  url,
}: {
  confirmingDelete: boolean
  disabled: boolean
  draftError: string | null
  editing: boolean
  isSaving: boolean
  pathMode: EndpointForwardPathMode
  target: EndpointForwardTarget
  url: string
  onCancelDelete: () => void
  onCancelEdit: () => void
  onConfirmDelete: () => void
  onEdit: () => void
  onPathModeChange: (pathMode: EndpointForwardPathMode) => void
  onRequestDelete: () => void
  onSaveEdit: () => void
  onToggleEnabled: () => void
  onUrlChange: (url: string) => void
}) {
  return (
    <li>
      <Collapse inert={editing} open={!editing}>
        <ForwardTargetItem
          confirmingDelete={confirmingDelete}
          disabled={disabled}
          target={target}
          onCancelDelete={onCancelDelete}
          onConfirmDelete={onConfirmDelete}
          onEdit={onEdit}
          onRequestDelete={onRequestDelete}
          onToggleEnabled={onToggleEnabled}
        />
      </Collapse>
      <Collapse inert={!editing} open={editing}>
        <ForwardTargetEditor
          draftError={editing ? draftError : null}
          editing
          isSaving={isSaving}
          pathMode={pathMode}
          url={url}
          onCancel={onCancelEdit}
          onPathModeChange={onPathModeChange}
          onSave={onSaveEdit}
          onUrlChange={onUrlChange}
        />
      </Collapse>
    </li>
  )
}

function AddTargetRow({
  draftError,
  isSaving,
  onCancel,
  onPathModeChange,
  onSave,
  onUrlChange,
  pathMode,
  url,
}: {
  draftError: string | null
  isSaving: boolean
  pathMode: EndpointForwardPathMode
  url: string
  onCancel: () => void
  onPathModeChange: (pathMode: EndpointForwardPathMode) => void
  onSave: () => void
  onUrlChange: (url: string) => void
}) {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <li>
      <Collapse open={open}>
        <ForwardTargetEditor
          draftError={draftError}
          editing={false}
          isSaving={isSaving}
          pathMode={pathMode}
          url={url}
          onCancel={onCancel}
          onPathModeChange={onPathModeChange}
          onSave={onSave}
          onUrlChange={onUrlChange}
        />
      </Collapse>
    </li>
  )
}

function Collapse({
  children,
  inert,
  open,
}: {
  children: React.ReactNode
  inert?: boolean
  open: boolean
}) {
  return (
    <div
      inert={inert || undefined}
      className={cn(
        "grid transition-[grid-template-rows] duration-75 ease-linear motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Something went wrong."
}
