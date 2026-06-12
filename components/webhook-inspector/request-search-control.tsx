import * as React from "react"
import {
  CircleHelpIcon,
  ListFilterIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  createDocsPageUrl,
  REQUEST_SEARCH_DOCS_PATH,
} from "@/lib/docs-links"
import {
  EMPTY_REQUEST_SEARCH,
  REQUEST_SEARCH_MAX_ADVANCED_LENGTH,
  REQUEST_SEARCH_MAX_CONDITIONS,
  parseAdvancedRequestSearchQuery,
  parseRequestSearchCriteria,
  requestSearchIsActive,
  isRequestSearchField,
  type BasicRequestSearchCriteria,
  type RequestSearchCriteria,
  type RequestSearchField,
} from "@/lib/webhooks/request-search"
import { cn } from "@/lib/utils"

const COMMON_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const
const DEFAULT_FIELD = "path" satisfies RequestSearchField

type SearchDraftCondition = {
  field: RequestSearchField
  value: string
}

const FIELD_OPTIONS = [
  { field: "path", label: "Path" },
  { field: "url", label: "URL" },
  { field: "body", label: "Body" },
  { field: "headers", label: "Headers" },
  { field: "query", label: "Query" },
  { field: "contentType", label: "Content-Type" },
  { field: "ip", label: "IP address" },
] as const satisfies readonly {
  field: RequestSearchField
  label: string
}[]

export function RequestSearchButton({
  disabled,
  docsUrl,
  search,
  onSearch,
}: {
  disabled: boolean
  docsUrl: string | null
  search: RequestSearchCriteria
  onSearch: (search: RequestSearchCriteria) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [tooltipOpen, setTooltipOpen] = React.useState(false)
  const activeCount = readActiveSearchCount(search)

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        setTooltipOpen(false)
      }}
    >
      <Tooltip
        open={tooltipOpen && !open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setTooltipOpen(false)
          }
        }}
      >
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label="Filter requests"
              className="relative rounded-md"
              onClick={() => setTooltipOpen(false)}
              onFocus={() => setTooltipOpen(false)}
              onPointerEnter={() => setTooltipOpen(true)}
              onPointerLeave={() => setTooltipOpen(false)}
            >
              <ListFilterIcon />
              {activeCount > 0 ? (
                <Badge
                  variant="secondary"
                  className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full border border-card px-1 text-[0.6rem] tabular-nums"
                >
                  {activeCount}
                </Badge>
              ) : null}
              <span className="sr-only">Filter</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Filter</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-[21rem] p-2.5">
        <RequestSearchForm
          key={createRequestSearchKey(search)}
          disabled={disabled}
          docsUrl={docsUrl}
          search={search}
          onApply={(next) => {
            onSearch(next)
            setTooltipOpen(false)
            setOpen(false)
          }}
          onClear={() => {
            onSearch(EMPTY_REQUEST_SEARCH)
            setTooltipOpen(false)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function readActiveSearchCount(search: RequestSearchCriteria) {
  if (search.mode === "advanced") {
    return 1
  }

  return search.methods.length + search.conditions.length
}

export function RequestSearchChips({
  className,
  disabled,
  search,
  onSearch,
}: {
  className?: string
  disabled: boolean
  search: RequestSearchCriteria
  onSearch: (search: RequestSearchCriteria) => void
}) {
  if (!requestSearchIsActive(search)) {
    return null
  }

  if (search.mode === "advanced") {
    return (
      <div
        className={cn(
          "mt-2.5 flex min-w-0 flex-wrap items-center gap-1",
          className
        )}
      >
        <FilterChip
          label="Advanced"
          value={search.query}
          disabled={disabled}
          onRemove={() => onSearch(EMPTY_REQUEST_SEARCH)}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "mt-2.5 flex min-w-0 flex-wrap items-center gap-1",
        className
      )}
    >
      {search.methods.map((method) => (
        <FilterChip
          key={`method:${method}`}
          value={method}
          disabled={disabled}
          onRemove={() =>
            onSearch({
              ...search,
              methods: search.methods.filter((item) => item !== method),
            })
          }
        />
      ))}
      {search.conditions.map((condition, index) => (
        <FilterChip
          key={`condition:${index}`}
          label={readFieldOption(condition.field).label}
          value={condition.value}
          disabled={disabled}
          onRemove={() =>
            onSearch({
              ...search,
              conditions: search.conditions.filter(
                (_condition, itemIndex) => itemIndex !== index
              ),
            })
          }
        />
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSearch(EMPTY_REQUEST_SEARCH)}
        className="rounded-sm px-1.5 py-0.5 text-[0.62rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        Clear all
      </button>
    </div>
  )
}

function FilterChip({
  label,
  value,
  disabled,
  onRemove,
}: {
  label?: string
  value: string
  disabled: boolean
  onRemove: () => void
}) {
  return (
    <span className="inline-flex h-6 min-w-0 items-center gap-1 rounded-sm border bg-background py-0.5 pr-0.5 pl-1.5 text-[0.62rem]">
      {label ? (
        <span className="shrink-0 text-muted-foreground">{label}</span>
      ) : null}
      <span className="max-w-[8rem] truncate font-mono font-medium text-foreground">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Remove ${label ? `${label} ` : ""}filter ${value}`}
        disabled={disabled}
        onClick={onRemove}
        className="flex size-4 shrink-0 items-center justify-center rounded-[3px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <XIcon className="size-3" />
      </button>
    </span>
  )
}

function RequestSearchForm({
  disabled,
  docsUrl,
  search,
  onApply,
  onClear,
}: {
  disabled: boolean
  docsUrl: string | null
  search: RequestSearchCriteria
  onApply: (search: RequestSearchCriteria) => void
  onClear: () => void
}) {
  const initialBasicSearch: BasicRequestSearchCriteria =
    search.mode === "basic"
      ? search
      : { mode: "basic", methods: [], conditions: [] }
  const [mode, setMode] = React.useState<RequestSearchCriteria["mode"]>(
    search.mode
  )
  const [methods, setMethods] = React.useState<string[]>(
    initialBasicSearch.methods
  )
  const [conditions, setConditions] = React.useState<SearchDraftCondition[]>(
    () =>
      initialBasicSearch.conditions.length > 0
        ? initialBasicSearch.conditions.map(({ field, value }) => ({
            field,
            value,
          }))
        : [createEmptyCondition()]
  )
  const [advancedQuery, setAdvancedQuery] = React.useState(
    search.mode === "advanced" ? search.query : ""
  )
  const [error, setError] = React.useState<string | null>(null)
  const searchSyntaxUrl = createDocsPageUrl(docsUrl, REQUEST_SEARCH_DOCS_PATH)
  const hasActiveSearch = requestSearchIsActive(search)

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed =
      mode === "advanced"
        ? parseAdvancedRequestSearchQuery(advancedQuery)
        : parseRequestSearchCriteria({ methods, conditions })

    if (parsed.kind === "valid") {
      setError(null)
      onApply(parsed.value)
      return
    }

    setError(parsed.error)
  }

  function toggleMethod(method: string) {
    setMethods((current) =>
      current.includes(method)
        ? current.filter((item) => item !== method)
        : [...current, method]
    )
  }

  function updateCondition(index: number, condition: SearchDraftCondition) {
    setConditions((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? condition : item))
    )
  }

  function removeCondition(index: number) {
    setConditions((current) => {
      const next = current.filter(
        (_condition, itemIndex) => itemIndex !== index
      )

      return next.length > 0 ? next : [createEmptyCondition()]
    })
  }

  function addCondition() {
    setConditions((current) => [...current, createEmptyCondition()])
  }

  return (
    <form className="flex min-w-0 flex-col gap-2.5" onSubmit={submitSearch}>
      <div className="grid grid-cols-2 rounded-sm border bg-background p-0.5">
        {(["basic", "advanced"] as const).map((searchMode) => (
          <button
            key={searchMode}
            type="button"
            disabled={disabled}
            onClick={() => {
              setMode(searchMode)
              setError(null)
            }}
            className={cn(
              "h-6 rounded-[3px] text-[0.62rem] font-medium capitalize transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              mode === searchMode && "bg-muted text-foreground"
            )}
          >
            {searchMode}
          </button>
        ))}
      </div>

      {mode === "basic" ? (
        <>
          <Fieldset label="Method">
            <div
              role="group"
              aria-label="Request method filter"
              className="grid grid-cols-4 gap-1"
            >
              {COMMON_METHODS.map((method) => (
                <MethodToggle
                  key={method}
                  label={method}
                  pressed={methods.includes(method)}
                  disabled={disabled}
                  onClick={() => toggleMethod(method)}
                />
              ))}
            </div>
          </Fieldset>

          <Fieldset label="Where">
            <div className="flex flex-col gap-1.5">
              {conditions.map((condition, index) => (
                <ConditionRow
                  key={index}
                  condition={condition}
                  disabled={disabled}
                  removable={conditions.length > 1}
                  onChange={(next) => updateCondition(index, next)}
                  onRemove={() => removeCondition(index)}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={
                disabled || conditions.length >= REQUEST_SEARCH_MAX_CONDITIONS
              }
              onClick={addCondition}
              className="mt-1.5 h-6 self-start rounded-sm px-1.5 text-[0.64rem]"
            >
              <PlusIcon data-icon="inline-start" />
              Add filter
            </Button>
          </Fieldset>
        </>
      ) : (
        <Fieldset
          label="Query"
          action={
            searchSyntaxUrl ? (
              <a
                href={searchSyntaxUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[0.6rem] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <CircleHelpIcon className="size-3" aria-hidden="true" />
                Search syntax
              </a>
            ) : null
          }
        >
          <Textarea
            value={advancedQuery}
            disabled={disabled}
            maxLength={REQUEST_SEARCH_MAX_ADVANCED_LENGTH}
            onChange={(event) => {
              setAdvancedQuery(event.currentTarget.value)
              setError(null)
            }}
            className="max-h-28 min-h-18 resize-y rounded-sm px-2 py-1.5 font-mono text-xs leading-relaxed md:text-xs"
            placeholder="method:POST AND query.id:123"
            aria-label="Advanced request search query"
          />
        </Fieldset>
      )}

      {error ? (
        <p className="text-[0.62rem] leading-snug text-destructive">{error}</p>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t pt-2.5">
        {hasActiveSearch ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={onClear}
            className="h-6 rounded-sm px-1.5 text-[0.64rem] text-muted-foreground"
          >
            Clear
          </Button>
        ) : (
          <span aria-hidden="true" />
        )}
        <Button
          type="submit"
          variant="default"
          size="sm"
          disabled={disabled}
          className="h-6 rounded-sm px-2 text-[0.64rem]"
        >
          <SearchIcon data-icon="inline-start" />
          Apply
        </Button>
      </div>
    </form>
  )
}

function ConditionRow({
  condition,
  disabled,
  removable,
  onChange,
  onRemove,
}: {
  condition: SearchDraftCondition
  disabled: boolean
  removable: boolean
  onChange: (condition: SearchDraftCondition) => void
  onRemove: () => void
}) {
  const option = readFieldOption(condition.field)

  return (
    <div className="grid min-w-0 grid-cols-[5.75rem_minmax(0,1fr)_auto] gap-1.5">
      <Select
        value={condition.field}
        disabled={disabled}
        onValueChange={(field) => {
          if (isRequestSearchField(field)) {
            onChange({ field, value: condition.value })
          }
        }}
      >
        <SelectTrigger
          size="sm"
          aria-label="Search field"
          className="h-7 w-full rounded-sm bg-background px-2 text-[0.66rem]"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start" className="min-w-[7rem]">
          {FIELD_OPTIONS.map((fieldOption) => (
            <SelectItem
              key={fieldOption.field}
              value={fieldOption.field}
              className="text-xs"
            >
              {fieldOption.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        density="compact"
        value={condition.value}
        disabled={disabled}
        maxLength={200}
        onChange={(event) =>
          onChange({ ...condition, value: event.currentTarget.value })
        }
        className="rounded-sm font-mono"
        placeholder="Contains"
        aria-label={`${option.label} search value`}
      />
      <button
        type="button"
        aria-label="Remove filter"
        disabled={disabled || !removable}
        onClick={onRemove}
        className="flex size-7 shrink-0 items-center justify-center rounded-sm border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  )
}

function Fieldset({
  action,
  label,
  children,
}: {
  action?: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.6rem] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        {action}
      </div>
      {children}
    </div>
  )
}

function MethodToggle({
  label,
  pressed,
  disabled,
  onClick,
}: {
  label: string
  pressed: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-7 min-w-0 rounded-sm border bg-background px-1 text-[0.62rem] font-medium transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        pressed && "border-foreground/35 bg-muted text-foreground"
      )}
    >
      {label}
    </button>
  )
}

function createEmptyCondition(): SearchDraftCondition {
  return { field: DEFAULT_FIELD, value: "" }
}

function readFieldOption(field: RequestSearchField) {
  return (
    FIELD_OPTIONS.find((option) => option.field === field) ?? FIELD_OPTIONS[0]
  )
}

function createRequestSearchKey(search: RequestSearchCriteria) {
  if (search.mode === "advanced") {
    return `advanced:${search.query}`
  }

  return [
    "basic",
    search.methods.join(","),
    ...search.conditions.map(
      (condition) => `${condition.field}:${condition.value}`
    ),
  ].join("|")
}
