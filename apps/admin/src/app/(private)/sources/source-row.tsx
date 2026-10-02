import { type ListedSource } from "@/data/sources/list-sources";
import { formatDate } from "@/lib/format";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";

/** Private uploads show a fixed label: their title is dropped before it reaches this row. */
export function SourceRow({ source }: { source: ListedSource }) {
  return (
    <TableRow>
      <TableCell className="max-w-80 min-w-56 whitespace-normal">
        <Link className="font-medium hover:underline" href={`/sources/${source.id}`} prefetch>
          {source.title ?? "Private upload"}
        </Link>
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
    </TableRow>
  );
}
