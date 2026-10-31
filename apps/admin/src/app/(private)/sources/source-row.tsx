import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { type ListedSource } from "@/data/sources/list-sources";
import { formatDate } from "@/lib/format";
import { TableCell } from "@zoonk/ui/components/table";

/** Private uploads show a fixed label: their title is dropped before it reaches this row. */
export function SourceRow({ source }: { source: ListedSource }) {
  return (
    <AdminTableRow>
      <TableCell className="max-w-80 min-w-56 whitespace-normal">
        <AdminTableRowLink className="font-medium" href={`/sources/${source.id}`} prefetch>
          {source.title ?? "Private upload"}
        </AdminTableRowLink>
        {source.title && source.publisher ? (
          <span className="text-muted-foreground block text-xs">{source.publisher}</span>
        ) : null}
      </TableCell>
      <TableCell className="capitalize">{source.kind}</TableCell>
      <TableCell className="capitalize">{source.visibility}</TableCell>
      <TableCell className="uppercase">{source.language}</TableCell>
      <TableCell className="text-muted-foreground">{formatDate(source.fetchedAt)}</TableCell>
      <TableCell className="text-muted-foreground">{formatDate(source.validUntil)}</TableCell>
      <TableCell className="text-muted-foreground">{formatDate(source.nextCheckAt)}</TableCell>
      <TableCell className="text-right tabular-nums">{source._count.learnerSources}</TableCell>
      <TableCell className="text-right tabular-nums">{source._count.examBlueprints}</TableCell>
    </AdminTableRow>
  );
}
