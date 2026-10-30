import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";

export type ContentTotalRow = { created?: number; title: string; total: number };

export function ContentTotalsTable({ rows }: { rows: readonly ContentTotalRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Created this period</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((row) => (
          <ContentRow key={row.title} row={row} />
        ))}
      </TableBody>
    </Table>
  );
}

function ContentRow({ row }: { row: ContentTotalRow }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{row.title}</TableCell>
      <TableCell className="text-right tabular-nums">{row.total.toLocaleString()}</TableCell>
      <TableCell className="text-right tabular-nums">
        {row.created === undefined ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          row.created.toLocaleString()
        )}
      </TableCell>
    </TableRow>
  );
}
