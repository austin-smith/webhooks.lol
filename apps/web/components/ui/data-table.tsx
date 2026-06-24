"use client"
"use no memo"

import * as React from "react"
import type {
  Column,
  ColumnDef,
  PaginationState,
  SortingState,
  Table as TanStackTable,
} from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type DataTablePaginationState = {
  direction: "asc" | "desc"
  page: number
  pageSize: number
  sort: string
  total: number
}

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[]
  columnFilters?: Record<string, React.ReactNode>
  data: TData[]
  emptyMessage?: string
  initialSorting?: SortingState
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  onSortChange?: (sort: { direction: "asc" | "desc"; id: string }) => void
  pageSize?: number
  pagination?: DataTablePaginationState
}

export function DataTable<TData, TValue>({
  columns,
  columnFilters,
  data,
  emptyMessage = "No matching rows.",
  initialSorting = [],
  onPageChange,
  onPageSizeChange,
  onSortChange,
  pageSize = 12,
  pagination,
}: DataTableProps<TData, TValue>) {
  // TanStack Table uses interior mutability, so this wrapper is an explicit React Compiler boundary.
  const isServerControlled = Boolean(pagination)
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
  const tablePagination: PaginationState | undefined = pagination
    ? {
        pageIndex: toTablePageIndex(pagination.page),
        pageSize: pagination.pageSize,
      }
    : undefined
  const currentSorting = pagination
    ? [
        {
          desc: pagination.direction === "desc",
          id: pagination.sort,
        },
      ]
    : sorting

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table uses interior mutability; this module is the non-memoized boundary.
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: tablePagination
      ? undefined
      : {
          pagination: {
            pageSize,
          },
        },
    manualFiltering: isServerControlled,
    manualPagination: isServerControlled,
    manualSorting: isServerControlled,
    onPaginationChange: tablePagination
      ? (updater) => {
          const nextPagination =
            typeof updater === "function" ? updater(tablePagination) : updater

          if (nextPagination.pageSize !== tablePagination.pageSize) {
            onPageSizeChange?.(nextPagination.pageSize)
            return
          }

          if (nextPagination.pageIndex !== tablePagination.pageIndex) {
            onPageChange?.(toServerPage(nextPagination.pageIndex))
          }
        }
      : undefined,
    onSortingChange: (updater) => {
      const nextSorting =
        typeof updater === "function" ? updater(currentSorting) : updater

      if (pagination) {
        const nextSort = nextSorting[0]

        if (nextSort) {
          onSortChange?.({
            direction: nextSort.desc ? "desc" : "asc",
            id: nextSort.id,
          })
        }

        return
      }

      setSorting(nextSorting)
    },
    rowCount: pagination?.total,
    state: {
      ...(tablePagination
        ? {
            pagination: tablePagination,
          }
        : {}),
      sorting: currentSorting,
    },
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <React.Fragment key={headerGroup.id}>
                <TableRow>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
                {columnFilters ? (
                  <TableRow>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={`${header.id}-filter`}>
                        {header.isPlaceholder
                          ? null
                          : columnFilters[header.column.id]}
                      </TableHead>
                    ))}
                  </TableRow>
                ) : null}
              </React.Fragment>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TableCount
          rowCount={data.length}
          table={table}
          totalCount={pagination?.total ?? data.length}
          pagination={pagination}
        />
        <TablePagination pagination={pagination} table={table} />
      </div>
    </div>
  )
}

function toTablePageIndex(page: number) {
  return Math.max(page - 1, 0)
}

function toServerPage(pageIndex: number) {
  return pageIndex + 1
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
}: {
  column: Column<TData, TValue>
  title: string
}) {
  if (!column.getCanSort()) {
    return title
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      className="-ml-2"
    >
      {title}
      <ArrowUpDownIcon data-icon="inline-end" aria-hidden="true" />
    </Button>
  )
}

function TableCount<TData>({
  pagination,
  rowCount,
  table,
  totalCount,
}: {
  pagination?: DataTablePaginationState
  rowCount: number
  table: TanStackTable<TData>
  totalCount: number
}) {
  if (pagination) {
    const { pageIndex, pageSize } = table.getState().pagination
    const firstRow = totalCount > 0 ? pageIndex * pageSize + 1 : 0
    const lastRow = firstRow > 0 ? firstRow + rowCount - 1 : 0

    return (
      <p className="text-sm text-muted-foreground">
        {firstRow.toLocaleString()}-{lastRow.toLocaleString()} of{" "}
        {pagination.total.toLocaleString()} rows
      </p>
    )
  }

  const filteredCount = table.getFilteredRowModel().rows.length

  return (
    <p className="text-sm text-muted-foreground">
      {filteredCount.toLocaleString()} of {totalCount.toLocaleString()} rows
    </p>
  )
}

function TablePagination<TData>({
  pagination,
  table,
}: {
  pagination?: DataTablePaginationState
  table: TanStackTable<TData>
}) {
  const pageCount = table.getPageCount()
  const pageNumber =
    pageCount > 0 ? table.getState().pagination.pageIndex + 1 : 0
  const canPreviousPage = table.getCanPreviousPage()
  const canNextPage = table.getCanNextPage()

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pagination ? (
        <Select
          value={String(pagination.pageSize)}
          onValueChange={(value) => table.setPageSize(Number(value))}
        >
          <SelectTrigger size="sm">
            <SelectValue aria-label={`${pagination.pageSize} rows`} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {[10, 25, 50, 100].map((pageSize) => (
                <SelectItem key={pageSize} value={String(pageSize)}>
                  {pageSize} rows
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : null}
      <p className="min-w-16 text-center text-sm text-muted-foreground">
        {pageNumber} / {pageCount}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => table.previousPage()}
        disabled={!canPreviousPage}
      >
        <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
        Previous
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => table.nextPage()}
        disabled={!canNextPage}
      >
        Next
        <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
      </Button>
    </div>
  )
}
