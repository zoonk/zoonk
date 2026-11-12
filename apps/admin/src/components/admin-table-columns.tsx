import { AdminSectionEmpty } from "@/components/admin-section";
import { AdminTableSkeletonRows } from "@/components/admin-table-skeleton";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowDownIcon } from "lucide-react";
import Link from "next/link";

export type AdminTableColumn = {
  align?: "right";
  /** The column that takes the room the others leave. The first one, unless another says so. */
  fill?: boolean;
  label: string;
  /** Makes the header a link that sorts the list by this column, highest or newest first. */
  sort?: { href: string; isActive: boolean };
};

/**
 * One column takes the room that's left and every other is at least one step wide, so a short
 * fact (a date, a count, a state) sits in the same place whatever the rows say, on every table.
 */
const FILL_COLUMN_CLASS = "w-full";
const FACT_COLUMN_CLASS = "min-w-28";

function AdminTableColumnHead({ column, fills }: { column: AdminTableColumn; fills: boolean }) {
  const { align, label, sort } = column;

  const className = cn(
    fills ? FILL_COLUMN_CLASS : FACT_COLUMN_CLASS,
    align === "right" && "text-right",
  );

  if (!sort) {
    return <TableHead className={className}>{label}</TableHead>;
  }

  return (
    <TableHead aria-sort={sort.isActive ? "descending" : undefined} className={className}>
      <Link
        aria-current={sort.isActive ? "page" : undefined}
        className={cn(
          "hover:text-foreground inline-flex min-h-11 w-full items-center gap-1 text-inherit transition-colors",
          align === "right" ? "justify-end" : "justify-start",
        )}
        href={sort.href}
        prefetch
      >
        {/* Before an end-aligned label, so the label still ends on its numbers' edge. */}
        {sort.isActive && align === "right" ? (
          <ArrowDownIcon aria-hidden="true" className="size-3.5" />
        ) : null}
        {label}
        {sort.isActive && align !== "right" ? (
          <ArrowDownIcon aria-hidden="true" className="size-3.5" />
        ) : null}
      </Link>
    </TableHead>
  );
}

function AdminTableColumnsHeader({ columns }: { columns: AdminTableColumn[] }) {
  const fillIndex = Math.max(
    0,
    columns.findIndex((column) => column.fill),
  );

  return (
    <TableHeader>
      <TableRow>
        {columns.map((column, index) => (
          <AdminTableColumnHead column={column} fills={index === fillIndex} key={column.label} />
        ))}
      </TableRow>
    </TableHeader>
  );
}

/** Every Admin table: its columns, its rows, and a sentence instead of an empty table. */
export function AdminTableColumns({
  children,
  columns,
  emptyLabel,
  isEmpty,
}: {
  children: React.ReactNode;
  columns: AdminTableColumn[];
  emptyLabel: string;
  isEmpty: boolean;
}) {
  if (isEmpty) {
    return <AdminSectionEmpty>{emptyLabel}</AdminSectionEmpty>;
  }

  return (
    <Table>
      <AdminTableColumnsHeader columns={columns} />
      <TableBody>{children}</TableBody>
    </Table>
  );
}

function AdminTableColumnsSkeletonRow({ columns }: { columns: AdminTableColumn[] }) {
  return (
    <TableRow>
      {columns.map((column) => (
        <TableCell key={column.label}>
          <Skeleton className={column.align === "right" ? "ml-auto h-4 w-8" : "h-4 w-20"} />
        </TableCell>
      ))}
    </TableRow>
  );
}

export function AdminTableColumnsSkeleton({ columns }: { columns: AdminTableColumn[] }) {
  return (
    <Table>
      <AdminTableColumnsHeader columns={columns} />
      <AdminTableSkeletonRows>
        <AdminTableColumnsSkeletonRow columns={columns} />
      </AdminTableSkeletonRows>
    </Table>
  );
}

/** What an empty list says: the search that found nothing, or that there's nothing yet. */
export function emptyListLabel({ noun, search }: { noun: string; search?: string }): string {
  return search ? `No ${noun} match "${search}".` : `No ${noun} yet.`;
}
