import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function CodePanel({ value }: { value: string }) {
  return (
    <ScrollArea className="h-[420px] rounded-md border bg-background sm:h-full">
      <pre className="min-w-0 overflow-x-auto p-4 text-xs leading-relaxed whitespace-pre-wrap">
        {value}
      </pre>
    </ScrollArea>
  )
}

export function KeyValueTable({
  values,
}: {
  values: Record<string, string | string[]>
}) {
  const entries = Object.entries(values)

  if (entries.length === 0) {
    return <CodePanel value="None" />
  }

  return (
    <ScrollArea className="h-[420px] rounded-md border bg-background sm:h-full">
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 w-[11rem] text-[0.68rem] text-muted-foreground">
              KEY
            </TableHead>
            <TableHead className="h-8 text-[0.68rem] text-muted-foreground">
              VALUE
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(([key, value]) => (
            <TableRow key={key}>
              <TableCell className="w-[11rem] max-w-[11rem] truncate align-top text-xs text-muted-foreground">
                {key}
              </TableCell>
              <TableCell className="whitespace-normal break-all text-xs">
                {Array.isArray(value) ? value.join(", ") : value}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}
