"use client"

import * as React from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import type { InboxNames } from "./types"
import { formatShortToken } from "./request-formatters"

type InboxSwitcherProps = {
  disabled: boolean
  inboxNames: InboxNames
  name: string
  recentTokens: string[]
  token: string | null
  onNewInbox: () => void
  onRenameInbox: (name: string) => void
  onSwitchInbox: (token: string) => void
}

export function InboxSwitcher({
  disabled,
  inboxNames,
  name,
  recentTokens,
  token,
  onNewInbox,
  onRenameInbox,
  onSwitchInbox,
}: InboxSwitcherProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [isRenaming, setIsRenaming] = React.useState(false)
  const [draftName, setDraftName] = React.useState("")
  const tokens = React.useMemo(
    () => getInboxTokens(token, recentTokens),
    [recentTokens, token]
  )
  const filteredTokens = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return tokens
    }

    return tokens.filter((recentToken) => {
      const inboxName = inboxNames[recentToken] ?? ""
      return `${inboxName} ${recentToken}`
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [inboxNames, query, tokens])

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)

    if (!nextOpen) {
      setQuery("")
      setIsRenaming(false)
      setDraftName("")
    }
  }

  const selectedLabel = name.trim() || formatShortToken(token)

  function switchInbox(nextToken: string) {
    onSwitchInbox(nextToken)
    changeOpen(false)
  }

  function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onRenameInbox(draftName.trim())
    setIsRenaming(false)
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Switch inbox"
          className="group flex h-10 min-w-0 items-center justify-between gap-2 rounded-l-md px-3 text-left transition-colors hover:bg-muted/55 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="min-w-0 truncate font-mono text-xs font-medium">
            {token ? selectedLabel : "Creating..."}
          </span>
          <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(16rem,calc(100vw-2rem))] p-0"
        align="start"
      >
        <div className="border-b p-2">
          <label className="flex h-8 items-center gap-2 rounded-sm border bg-background px-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
            <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="sr-only">Search inboxes</span>
            <Input
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              className="h-7 border-0 bg-transparent px-0 font-mono text-xs shadow-none focus-visible:ring-0 md:text-xs"
              placeholder="Search inboxes"
            />
          </label>
        </div>

        <ScrollArea className="max-h-64">
          <div className="flex flex-col gap-1 p-1">
            {filteredTokens.length > 0 ? (
              filteredTokens.map((recentToken) => (
                <InboxSwitcherRow
                  key={recentToken}
                  inboxNames={inboxNames}
                  isRenaming={isRenaming && recentToken === token}
                  nameDraft={draftName}
                  selected={recentToken === token}
                  token={recentToken}
                  onChangeNameDraft={setDraftName}
                  onCancelRename={() => {
                    setDraftName("")
                    setIsRenaming(false)
                  }}
                  onRename={() => {
                    setDraftName(name)
                    setIsRenaming(true)
                  }}
                  onSaveName={saveName}
                  onSelect={() => switchInbox(recentToken)}
                />
              ))
            ) : (
              <div className="px-2 py-6 text-center text-[0.72rem] text-muted-foreground">
                No matching inbox
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onNewInbox()
              changeOpen(false)
            }}
            className="flex h-9 w-full items-center gap-2 rounded-sm px-2 text-left text-xs transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusIcon className="size-3.5 text-muted-foreground" />
            <span>New inbox</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function InboxSwitcherRow({
  inboxNames,
  isRenaming,
  nameDraft,
  selected,
  token,
  onChangeNameDraft,
  onCancelRename,
  onRename,
  onSaveName,
  onSelect,
}: {
  inboxNames: InboxNames
  isRenaming: boolean
  nameDraft: string
  selected: boolean
  token: string
  onChangeNameDraft: (name: string) => void
  onCancelRename: () => void
  onRename: () => void
  onSaveName: (event: React.FormEvent<HTMLFormElement>) => void
  onSelect: () => void
}) {
  const name = inboxNames[token]?.trim()
  const shortToken = formatShortToken(token)

  if (isRenaming) {
    return (
      <form
        className="flex min-h-10 items-center gap-1.5 rounded-sm bg-muted p-1.5"
        onSubmit={onSaveName}
      >
        <Input
          autoFocus
          aria-label="Inbox label"
          value={nameDraft}
          onChange={(event) => onChangeNameDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              onCancelRename()
            }
          }}
          className="h-7 rounded-sm font-mono text-xs"
          maxLength={32}
        />
        <Button type="submit" size="sm" className="rounded-sm">
          Save
        </Button>
        <button
          type="button"
          aria-label="Cancel rename"
          onClick={onCancelRename}
          className="flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <XIcon className="size-3.5" />
        </button>
      </form>
    )
  }

  return (
    <div
      className={cn(
        "grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-sm transition-colors hover:bg-muted",
        selected && "bg-muted"
      )}
    >
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        className="flex min-w-0 flex-col px-2 py-1.5 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="truncate text-xs font-medium">
          {name || shortToken}
        </span>
        {name ? (
          <span className="truncate text-[0.68rem] text-muted-foreground">
            {shortToken}
          </span>
        ) : null}
      </button>
      <span className="flex items-center gap-0.5 pr-1.5">
        {selected ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Rename selected inbox"
                  onClick={onRename}
                  className="flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <PencilIcon className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Rename inbox</TooltipContent>
            </Tooltip>
            <CheckIcon className="size-3.5 text-foreground" />
          </>
        ) : null}
      </span>
    </div>
  )
}

function getInboxTokens(token: string | null, recentTokens: string[]) {
  return Array.from(new Set(token ? [token, ...recentTokens] : recentTokens))
}
