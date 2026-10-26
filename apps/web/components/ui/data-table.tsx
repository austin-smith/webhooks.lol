"use client"

import * as React from "react"
import type {
  Column,
  ColumnDef,
  PaginationState,
  ReactTable,
  RowData,
  SortingState,
} from "@tanstack/react-table"
import {
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
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

// Rows arrive already filtered, sorted, and paginated by the server, so the
// table only needs the sorting and pagination APIs, not client row models.
const dataTableFeatures = tableFeatures({
  rowPaginationFeature,
  rowSortingFeature,
})

type DataTableFeatures = typeof dataTableFeatures

export type DataTableColumnDef<TData extends RowData> = ColumnDef<
  DataTableFeatures,
  TData
>

type DataTablePaginationState = {
  direction: "asc" | "desc"
  page: number
  pageSize: number
  sort: string
  total: number
}

type DataTableProps<TData extends RowData> = {
  columns: DataTableColumnDef<TData>[]
  columnFilters?: Record<string, React.ReactNode>
  data: TData[]
  emptyMessage?: string
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onSortChange: (sort: { direction: "asc" | "desc"; id: string }) => void
  pagination: DataTablePaginationState
}

export function DataTable<TData extends RowData>({
  columns,
  columnFilters,
  data,
  emptyMessage = "No matching rows.",
  onPageChange,
  onPageSizeChange,
  onSortChange,
  pagination,
}: DataTableProps<TData>) {
  const tablePagination: PaginationState = {
    pageIndex: toTablePageIndex(pagination.page),
    pageSize: pagination.pageSize,
  }
  const tableSorting: SortingState = [
    {
      desc: pagination.direction === "desc",
      id: pagination.sort,
    },
  ]

  const table = useTable({
    columns,
    data,
    features: dataTableFeatures,
    manualPagination: true,
    manualSorting: true,
    onPaginationChange: (updater) => {
      const nextPagination =
        typeof updater === "function" ? updater(tablePagination) : updater

      if (nextPagination.pageSize !== tablePagination.pageSize) {
        onPageSizeChange(nextPagination.pageSize)
        return
      }

      if (nextPagination.pageIndex !== tablePagination.pageIndex) {
        onPageChange(toServerPage(nextPagination.pageIndex))
      }
    },
    onSortingChange: (updater) => {
      const nextSorting =
        typeof updater === "function" ? updater(tableSorting) : updater
      const nextSort = nextSorting[0]

      if (nextSort) {
        onSortChange({
          direction: nextSort.desc ? "desc" : "asc",
          id: nextSort.id,
        })
      }
    },
    rowCount: pagination.total,
    state: {
      pagination: tablePagination,
      sorting: tableSorting,
    },
  })
  const rows = table.getRowModel().rows

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
                      {header.isPlaceholder ? null : (
                        <table.FlexRender header={header} />
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
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
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
        <TableCount pagination={pagination} rowCount={rows.length} />
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

export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  title,
}: {
  column: Column<DataTableFeatures, TData, TValue>
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

function TableCount({
  pagination,
  rowCount,
}: {
  pagination: DataTablePaginationState
  rowCount: number
}) {
  const firstRow =
    pagination.total > 0
      ? toTablePageIndex(pagination.page) * pagination.pageSize + 1
      : 0
  const lastRow = firstRow > 0 ? firstRow + rowCount - 1 : 0

  return (
    <p className="text-sm text-muted-foreground">
      {firstRow.toLocaleString()}-{lastRow.toLocaleString()} of{" "}
      {pagination.total.toLocaleString()} rows
    </p>
  )
}

function TablePagination<TData extends RowData>({
  pagination,
  table,
}: {
  pagination: DataTablePaginationState
  table: ReactTable<DataTableFeatures, TData>
}) {
  const pageCount = table.getPageCount()
  const pageNumber = pageCount > 0 ? table.state.pagination.pageIndex + 1 : 0

  return (
    <div className="flex flex-wrap items-center gap-2">
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
      <p className="min-w-16 text-center text-sm text-muted-foreground">
        {pageNumber} / {pageCount}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
      >
        <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
        Previous
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
      >
        Next
        <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
      </Button>
    </div>
  )
}
