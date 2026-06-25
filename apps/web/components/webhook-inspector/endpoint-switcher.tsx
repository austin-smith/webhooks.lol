"use client"

import * as React from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import type { EndpointNames } from "./types"
import type { EndpointAccountStatus } from "./endpoint-session/transport"
import { formatShortEndpointId } from "./request-formatters"

type EndpointSwitcherProps = {
  disabled: boolean
  endpointAccountStatuses: Record<string, EndpointAccountStatus>
  endpointNames: EndpointNames
  isDeletingEndpoint: boolean
  isSignedIn: boolean
  isSavingEndpointToAccount: boolean
  name: string
  recentEndpointIds: string[]
  endpointId: string | null
  onLoadEndpointAccountStatus: (
    endpointId?: string
  ) => Promise<EndpointAccountStatus | null>
  onDeleteEndpoint: (endpointId: string) => Promise<void>
  onNewEndpoint: () => void
  onRenameEndpoint: (endpointId: string, name: string) => void
  onSaveEndpointToAccount: (
    endpointId?: string
  ) => Promise<EndpointAccountStatus | null>
  onSwitchEndpoint: (endpointId: string) => void
}

export function EndpointSwitcher({
  disabled,
  endpointAccountStatuses,
  endpointNames,
  isDeletingEndpoint,
  isSignedIn,
  isSavingEndpointToAccount,
  name,
  recentEndpointIds,
  endpointId,
  onLoadEndpointAccountStatus,
  onDeleteEndpoint,
  onNewEndpoint,
  onRenameEndpoint,
  onSaveEndpointToAccount,
  onSwitchEndpoint,
}: EndpointSwitcherProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [renamingEndpointId, setRenamingEndpointId] = React.useState<
    string | null
  >(null)
  const [draftName, setDraftName] = React.useState("")
  const [deleteConfirmEndpointId, setDeleteConfirmEndpointId] = React.useState<
    string | null
  >(null)
  const filteredEndpointIds = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return recentEndpointIds
    }

    return recentEndpointIds.filter((recentEndpointId) => {
      const endpointName = endpointNames[recentEndpointId] ?? ""
      return `${endpointName} ${recentEndpointId}`
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [endpointNames, query, recentEndpointIds])

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)

    if (!nextOpen) {
      setQuery("")
      setRenamingEndpointId(null)
      setDraftName("")
    }
  }

  const selectedLabel = name.trim() || formatShortEndpointId(endpointId)

  function switchEndpoint(nextEndpointId: string) {
    onSwitchEndpoint(nextEndpointId)
    changeOpen(false)
  }

  function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!renamingEndpointId) {
      return
    }

    onRenameEndpoint(renamingEndpointId, draftName.trim())
    setRenamingEndpointId(null)
  }

  React.useEffect(() => {
    if (!open || !isSignedIn) {
      return
    }

    for (const recentEndpointId of filteredEndpointIds) {
      if (!endpointAccountStatuses[recentEndpointId]) {
        void onLoadEndpointAccountStatus(recentEndpointId).catch(
          () => undefined
        )
      }
    }
  }, [
    endpointAccountStatuses,
    filteredEndpointIds,
    isSignedIn,
    onLoadEndpointAccountStatus,
    open,
  ])

  return (
    <>
      <Popover open={open} onOpenChange={changeOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Switch endpoint"
            className="group flex h-10 min-w-0 items-center justify-between gap-2 rounded-l-md px-3 text-left transition-colors hover:bg-muted/55 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-expanded:bg-muted"
          >
            {endpointId ? (
              <span className="min-w-0 animate-in truncate font-mono text-xs font-medium duration-200 fade-in-0 motion-reduce:animate-none">
                {selectedLabel}
              </span>
            ) : (
              <Skeleton className="h-3 w-20 rounded-sm" aria-hidden="true" />
            )}
            <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(18rem,calc(100vw-2rem))] overflow-hidden p-0"
          align="start"
        >
          <div className="border-b p-2">
            <label className="flex h-8 items-center gap-2 rounded-sm border bg-background px-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
              <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="sr-only">Search endpoints</span>
              <Input
                density="compact"
                variant="embedded"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                className="px-0 font-mono"
                placeholder="Search endpoints"
              />
            </label>
          </div>

          <div
            className="overflow-y-auto overscroll-contain"
            style={{
              maxHeight:
                "clamp(8rem, calc(var(--radix-popover-content-available-height) - 6rem), 18rem)",
            }}
          >
            <div className="flex flex-col gap-1 p-1.5">
              {filteredEndpointIds.length > 0 ? (
                filteredEndpointIds.map((recentEndpointId) => (
                  <EndpointSwitcherRow
                    key={recentEndpointId}
                    endpointNames={endpointNames}
                    endpointStatus={endpointAccountStatuses[recentEndpointId]}
                    isDeletingEndpoint={isDeletingEndpoint}
                    isSignedIn={isSignedIn}
                    isSavingEndpointToAccount={isSavingEndpointToAccount}
                    isRenaming={renamingEndpointId === recentEndpointId}
                    nameDraft={draftName}
                    selected={recentEndpointId === endpointId}
                    endpointId={recentEndpointId}
                    onChangeNameDraft={setDraftName}
                    onCancelRename={() => {
                      setDraftName("")
                      setRenamingEndpointId(null)
                    }}
                    onRequestDelete={() => {
                      changeOpen(false)
                      setDeleteConfirmEndpointId(recentEndpointId)
                    }}
                    onRename={() => {
                      setDraftName(endpointNames[recentEndpointId] ?? "")
                      setRenamingEndpointId(recentEndpointId)
                    }}
                    onSaveToAccount={() =>
                      onSaveEndpointToAccount(recentEndpointId)
                    }
                    onSaveName={saveName}
                    onSelect={() => switchEndpoint(recentEndpointId)}
                  />
                ))
              ) : (
                <div className="px-2 py-6 text-center text-[0.72rem] text-muted-foreground">
                  No matching endpoint
                </div>
              )}
            </div>
          </div>

          <div className="border-t bg-popover p-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onNewEndpoint()
                changeOpen(false)
              }}
              className="flex h-9 w-full items-center gap-2 rounded-sm border border-transparent px-2 text-left text-xs transition-colors hover:border-border hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusIcon className="size-3.5 text-muted-foreground" />
              <span>New endpoint</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <DeleteEndpointAlertDialog
        endpointId={deleteConfirmEndpointId}
        name={
          deleteConfirmEndpointId
            ? (endpointNames[deleteConfirmEndpointId] ?? "")
            : ""
        }
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteConfirmEndpointId(null)
          }
        }}
        onDeleteEndpoint={onDeleteEndpoint}
      />
    </>
  )
}

function EndpointSwitcherRow({
  endpointStatus,
  endpointNames,
  isDeletingEndpoint,
  isSignedIn,
  isSavingEndpointToAccount,
  isRenaming,
  nameDraft,
  selected,
  endpointId,
  onChangeNameDraft,
  onCancelRename,
  onRequestDelete,
  onRename,
  onSaveToAccount,
  onSaveName,
  onSelect,
}: {
  endpointStatus: EndpointAccountStatus | null | undefined
  endpointNames: EndpointNames
  isDeletingEndpoint: boolean
  isSignedIn: boolean
  isSavingEndpointToAccount: boolean
  isRenaming: boolean
  nameDraft: string
  selected: boolean
  endpointId: string
  onChangeNameDraft: (name: string) => void
  onCancelRename: () => void
  onRequestDelete: () => void
  onRename: () => void
  onSaveToAccount: () => Promise<EndpointAccountStatus | null>
  onSaveName: (event: React.FormEvent<HTMLFormElement>) => void
  onSelect: () => void
}) {
  const name = endpointNames[endpointId]?.trim()
  const shortId = formatShortEndpointId(endpointId)
  const canSaveToAccount =
    isSignedIn && Boolean(endpointStatus?.canSaveToAccount)

  if (isRenaming) {
    return (
      <form
        className="grid h-11 grid-cols-[1.25rem_minmax(0,1fr)_auto_auto] items-center gap-1.5 rounded-sm bg-muted p-1.5"
        onSubmit={onSaveName}
      >
        <span
          className="flex size-5 items-center justify-center text-foreground"
          aria-hidden="true"
        >
          {selected ? <CheckIcon className="size-3.5" /> : null}
        </span>
        <Input
          autoFocus
          aria-label="Endpoint label"
          density="compact"
          value={nameDraft}
          onChange={(event) => onChangeNameDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              onCancelRename()
            }
          }}
          className="rounded-sm font-mono"
          maxLength={32}
        />
        <Button
          type="submit"
          size="icon-sm"
          className="rounded-sm"
          aria-label="Save endpoint label"
        >
          <CheckIcon data-icon="inline-start" />
          <span className="sr-only">Save endpoint label</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-sm"
          aria-label="Cancel rename"
          onClick={onCancelRename}
        >
          <XIcon data-icon="inline-start" />
          <span className="sr-only">Cancel rename</span>
        </Button>
      </form>
    )
  }

  return (
    <div
      className={cn(
        "group/endpoint-row grid h-11 grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-1 rounded-sm transition-colors hover:bg-muted",
        selected && "bg-muted"
      )}
    >
      <span
        className="flex size-5 items-center justify-center text-foreground"
        aria-hidden="true"
      >
        {selected ? <CheckIcon className="size-3.5" /> : null}
      </span>
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        className="flex min-w-0 flex-col py-1.5 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="truncate text-xs font-medium">{name || shortId}</span>
        {name ? (
          <span className="truncate text-[0.68rem] text-muted-foreground">
            {shortId}
          </span>
        ) : null}
      </button>
      <span className="flex items-center gap-0.5 pr-1.5">
        {canSaveToAccount ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Claim this endpoint to my account"
                disabled={isSavingEndpointToAccount}
                onClick={() => {
                  void onSaveToAccount().catch(() => undefined)
                }}
                className="flex h-7 items-center gap-1 rounded-sm border px-1.5 text-[0.65rem] font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                Claim
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              Claim this endpoint to my account
            </TooltipContent>
          </Tooltip>
        ) : null}
        <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within/endpoint-row:opacity-100 group-hover/endpoint-row:opacity-100 [@media(hover:none)]:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-sm"
                aria-label={`Rename ${name || shortId}`}
                onClick={onRename}
              >
                <PencilIcon data-icon="inline-start" />
                <span className="sr-only">Rename {name || shortId}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Rename endpoint</TooltipContent>
          </Tooltip>
          <DeleteEndpointButton
            disabled={isDeletingEndpoint}
            label={`Delete ${name || shortId}`}
            onClick={onRequestDelete}
          />
        </span>
      </span>
    </div>
  )
}

function DeleteEndpointButton({
  disabled,
  label,
  onClick,
}: {
  disabled: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost-destructive"
          size="icon-sm"
          className="rounded-sm"
          disabled={disabled}
          aria-label={label}
          onClick={onClick}
        >
          <Trash2Icon data-icon="inline-start" />
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">Delete endpoint</TooltipContent>
    </Tooltip>
  )
}

function DeleteEndpointAlertDialog({
  endpointId,
  name,
  onOpenChange,
  onDeleteEndpoint,
}: {
  endpointId: string | null
  name: string
  onOpenChange: (open: boolean) => void
  onDeleteEndpoint: (endpointId: string) => Promise<void>
}) {
  const shortId = formatShortEndpointId(endpointId)
  const endpointLabel = name.trim() ? `${name.trim()} (${shortId})` : shortId

  return (
    <AlertDialog open={Boolean(endpointId)} onOpenChange={onOpenChange}>
      <AlertDialogContent size="default" className="gap-3">
        <AlertDialogHeader className="place-items-start text-left">
          <AlertDialogTitle className="text-sm leading-snug">
            Delete {endpointLabel}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs leading-relaxed">
            This will permanently delete the endpoint URL, captured requests,
            and any configured settings.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            size="sm"
            onClick={() => {
              if (!endpointId) {
                return
              }

              void onDeleteEndpoint(endpointId).catch(() => undefined)
            }}
          >
            Delete endpoint
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
