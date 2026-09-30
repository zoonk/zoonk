import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";

export type ContentTotalRow = { created?: number; title: string; total: number };

/**
 * Current inventory beside what was created in the selected period. Rows without a period count
 * (such as lesson outlines) show a dash.
 */
export function ContentTotalsTable({ rows }: { rows: readonly ContentTotalRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Created This Period</TableHead>
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
