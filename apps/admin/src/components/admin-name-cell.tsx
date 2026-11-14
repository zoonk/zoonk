import { AdminTableRowLink } from "@/components/admin-table-row";
import { TableCell } from "@zoonk/ui/components/table";
import { type Route } from "next";

/**
 * A row's first cell: what the record is, then one quiet line that tells it from its neighbors.
 * It is the row's link, so the whole row opens the record.
 */
export function AdminNameCell<Href extends string>({
  href,
  icon,
  note,
  title,
}: {
  href: Route<Href>;
  /** What kind of record it is, before its name. */
  icon?: React.ReactNode;
  note?: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <TableCell>
      <AdminTableRowLink className="flex min-w-0 items-start gap-2.5" href={href} prefetch>
        {icon ? (
          <span className="text-muted-foreground flex h-5 shrink-0 items-center [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0">
          <span className="text-foreground line-clamp-2 font-medium whitespace-normal">
            {title}
          </span>
          {note ? (
            <span className="text-muted-foreground block truncate text-xs">{note}</span>
          ) : null}
        </span>
      </AdminTableRowLink>
    </TableCell>
  );
}
