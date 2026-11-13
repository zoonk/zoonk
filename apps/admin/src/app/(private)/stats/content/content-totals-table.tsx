import { AdminTableRow } from "@/components/admin-table-row";
import { Table, TableBody, TableCell, TableHead, TableHeader } from "@zoonk/ui/components/table";

export type ContentTotalRow = { created?: number; title: string; total: number };

export function ContentTotalsTable({ rows }: { rows: readonly ContentTotalRow[] }) {
  return (
    <Table>
      <TableHeader>
        <AdminTableRow>
          <TableHead>Type</TableHead>
          <TableHead numeric>Total</TableHead>
          <TableHead numeric>Created this period</TableHead>
        </AdminTableRow>
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
    <AdminTableRow>
      <TableCell className="font-medium">{row.title}</TableCell>
      <TableCell numeric>{row.total.toLocaleString()}</TableCell>
      <TableCell numeric>
        {row.created === undefined ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          row.created.toLocaleString()
        )}
      </TableCell>
    </AdminTableRow>
  );
}
