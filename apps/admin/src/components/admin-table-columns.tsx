import { AdminSectionEmpty } from "@/components/admin-section";
import { AdminTableRow } from "@/components/admin-table-row";
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
import { type CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";
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
  /**
   * A fact that isn't the width of a date or a count: `narrow` for one short word, `wide` for a
   * few words, `text` for a name or a date with its time, `long` for a sentence.
   */
  size?: "long" | "narrow" | "text" | "wide";
  /** The cell holds a name over a second line, so a row that's loading is as tall as a loaded one. */
  twoLines?: boolean;
};

/**
 * Columns have set widths, so nothing moves when the rows load, sort, filter or change page: one
 * column takes the room that's left and every other is a number of 56 px steps wide, two for a
 * short fact. A fact longer than its column is cut with an ellipsis, or wraps where its cell says.
 */
const SIZES = {
  fact: { className: "w-28", rem: 7 },
  long: { className: "w-84", rem: 21 },
  narrow: { className: "w-21", rem: 5.25 },
  text: { className: "w-56", rem: 14 },
  wide: { className: "w-42", rem: 10.5 },
} as const;

// A cell that holds a control keeps its focus ring: it isn't cut. Narrower than its set columns
// and a first column worth reading (wider on a phone, where it is most of the screen), the table
// scrolls sideways.
const FIXED_TABLE_CLASS =
  "table-fixed min-w-[calc(var(--facts-width)+14rem)] md:min-w-[calc(var(--facts-width)+6rem)] [&_:is(td,th)]:overflow-hidden [&_:is(td,th)]:text-ellipsis [&_td:has(button,input,select)]:overflow-visible";

// A control keeps the row at 44 px and centers on its first line, like the text beside it: a 44 px
// field or select fills that line, a 30 px button sits 7 px down. (A button's baseline is its icon's
// bottom, so baseline alignment would lift its label 5 px.)
const CONTROL_CELL_CLASS =
  "[&_td:has(button,input,select)]:py-0 [&_td:has(button,input,select)]:align-top [&_td:has(button):not(:has(input:not([type=hidden]),select))]:pt-[0.4375rem]";

function fillIndexOf(columns: AdminTableColumn[]) {
  return Math.max(
    0,
    columns.findIndex((column) => column.fill),
  );
}

function factsWidth(columns: AdminTableColumn[]) {
  const fillIndex = fillIndexOf(columns);

  const rem = columns.reduce(
    (total, column, index) =>
      index === fillIndex ? total : total + SIZES[column.size ?? "fact"].rem,
    0,
  );

  return `${rem}rem`;
}

function AdminTable({
  children,
  columns,
  unsized = false,
}: {
  children: React.ReactNode;
  columns: AdminTableColumn[];
  unsized?: boolean;
}) {
  const factsStyle: CSSPropertiesWithVariables = { "--facts-width": factsWidth(columns) };

  return (
    <Table
      className={cn(CONTROL_CELL_CLASS, !unsized && FIXED_TABLE_CLASS)}
      style={unsized ? undefined : factsStyle}
    >
      <AdminTableColumnsHeader columns={columns} unsized={unsized} />
      {children}
    </Table>
  );
}

function AdminTableColumnHead({ column, sized }: { column: AdminTableColumn; sized: boolean }) {
  const { align, label, sort } = column;

  const className = cn(
    sized && SIZES[column.size ?? "fact"].className,
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
          "hover:text-foreground hit-area relative inline-block w-full text-inherit transition-colors [&>svg]:inline [&>svg]:align-[-0.125em]",
          align === "right" ? "text-right [&>svg]:me-1" : "text-left [&>svg]:ms-1",
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

function AdminTableColumnsHeader({
  columns,
  unsized,
}: {
  columns: AdminTableColumn[];
  unsized: boolean;
}) {
  const fillIndex = fillIndexOf(columns);

  return (
    <TableHeader>
      <TableRow>
        {columns.map((column, index) => (
          <AdminTableColumnHead
            column={column}
            key={column.label}
            sized={!unsized && index !== fillIndex}
          />
        ))}
      </TableRow>
    </TableHeader>
  );
}

/**
 * Every Admin table: its columns, its rows, and a sentence instead of an empty table. `unsized`
 * is only for the pages not rebuilt yet, whose nine or ten columns still size to their text.
 */
export function AdminTableColumns({
  children,
  columns,
  emptyLabel,
  isEmpty,
  unsized,
}: {
  children: React.ReactNode;
  columns: AdminTableColumn[];
  emptyLabel: string;
  isEmpty: boolean;
  unsized?: boolean;
}) {
  if (isEmpty) {
    return <AdminSectionEmpty>{emptyLabel}</AdminSectionEmpty>;
  }

  return (
    <AdminTable columns={columns} unsized={unsized}>
      <TableBody>{children}</TableBody>
    </AdminTable>
  );
}

function AdminTableColumnsSkeletonRow({ columns }: { columns: AdminTableColumn[] }) {
  return (
    <AdminTableRow>
      {columns.map((column) => (
        <TableCell key={column.label}>
          {column.twoLines ? (
            <div className="flex h-9 flex-col justify-center gap-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
          ) : (
            <Skeleton className={column.align === "right" ? "ml-auto h-4 w-8" : "h-4 w-20"} />
          )}
        </TableCell>
      ))}
    </AdminTableRow>
  );
}

export function AdminTableColumnsSkeleton({
  columns,
  unsized,
}: {
  columns: AdminTableColumn[];
  unsized?: boolean;
}) {
  return (
    <AdminTable columns={columns} unsized={unsized}>
      <AdminTableSkeletonRows>
        <AdminTableColumnsSkeletonRow columns={columns} />
      </AdminTableSkeletonRows>
    </AdminTable>
  );
}

/** What an empty list says: the search that found nothing, or that there's nothing yet. */
export function emptyListLabel({ noun, search }: { noun: string; search?: string }): string {
  return search ? `No ${noun} match "${search}".` : `No ${noun} yet.`;
}
