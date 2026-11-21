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
// and a first column worth reading, the table scrolls sideways.
const FIXED_TABLE_CLASS =
  "table-fixed md:min-w-[calc(var(--facts-width)+6rem)] [&_:is(td,th)]:overflow-hidden [&_:is(td,th)]:text-ellipsis [&_td:has(button,input,select)]:overflow-visible";

/**
 * On a phone a row is a card: its name, then each other value on a line of its own beside its
 * column's name, so no column hides past the screen's edge. The header keeps only the columns that
 * sort the list, as one line of links.
 */
const PHONE_ROWS_CLASS = cn(
  "max-md:block max-md:[&_tbody]:block max-md:[&_tbody_tr]:flex max-md:[&_tbody_tr]:flex-col max-md:[&_tbody_tr]:gap-1.5 max-md:[&_tbody_tr]:py-3 max-md:[&_td]:flow-root",
  "max-md:[&_td]:py-0! max-md:[&_td]:ps-0 max-md:[&_td]:pe-0 max-md:[&_td]:text-left max-md:[&_td]:whitespace-normal",
  // Floated into the cell's start padding, so the cell stays unpositioned and a row's link still
  // stretches over the whole row. A long name wraps, and the cell holds it.
  "max-md:[&_td]:before:text-muted-foreground max-md:[&_td]:before:float-start max-md:[&_td]:before:-ms-32 max-md:[&_td]:before:w-28 max-md:[&_td]:before:font-sans max-md:[&_td]:before:text-sm max-md:[&_td]:before:leading-5",
  "max-md:[&_th]:w-auto max-md:[&_th]:px-0 max-md:[&_th:not(:has(a))]:hidden max-md:[&_thead_tr]:flex max-md:[&_thead_tr]:flex-wrap max-md:[&_thead_tr]:gap-x-6 max-md:[&_thead:not(:has(a))]:hidden",
);

/**
 * A value's room beside its column's name on a phone. Tailwind reads class names from the source,
 * so each column's is written out; the name itself comes from `--column-n`.
 */
const PHONE_LABELED_CELL_CLASS = [
  "",
  "max-md:[&_td:nth-child(2)]:ps-32 max-md:[&_td:nth-child(2)]:before:content-(--column-2)",
  "max-md:[&_td:nth-child(3)]:ps-32 max-md:[&_td:nth-child(3)]:before:content-(--column-3)",
  "max-md:[&_td:nth-child(4)]:ps-32 max-md:[&_td:nth-child(4)]:before:content-(--column-4)",
  "max-md:[&_td:nth-child(5)]:ps-32 max-md:[&_td:nth-child(5)]:before:content-(--column-5)",
  "max-md:[&_td:nth-child(6)]:ps-32 max-md:[&_td:nth-child(6)]:before:content-(--column-6)",
  "max-md:[&_td:nth-child(7)]:ps-32 max-md:[&_td:nth-child(7)]:before:content-(--column-7)",
  "max-md:[&_td:nth-child(8)]:ps-32 max-md:[&_td:nth-child(8)]:before:content-(--column-8)",
] as const;

function phoneColumnLabels(columns: AdminTableColumn[]) {
  const labeled = columns.flatMap((column, index) => (index > 0 && column.label ? [index] : []));

  return {
    className: labeled.map((index) => PHONE_LABELED_CELL_CLASS[index]),
    style: Object.fromEntries(
      labeled.map((index) => [`--column-${index + 1}`, JSON.stringify(columns[index]?.label)]),
    ),
  };
}

// A control keeps the row at 44 px and sits on its first line, like the text beside it: a 44 px
// field or select fills that line, and a 30 px button sits 9 px down, where its 13 px label shares
// the 14 px text's baseline. (A button's baseline is its icon's bottom, so baseline alignment would
// lift its label 5 px.) A file input hides inside a button (`FileButton`), so it counts as one. A
// cell that leads with text and puts its control under it (`data-stacked`) keeps the text's room.
const CONTROL_CELL_CLASS =
  "md:[&_td:not([data-stacked]):has(button,input,select)]:py-0 md:[&_td:not([data-stacked]):has(button,input,select)]:align-top md:[&_td:not([data-stacked]):has(button):not(:has(input:not([type=hidden],[type=file]),select))]:pt-[0.5625rem]";

/**
 * A column set to the right ends its values on its header's edge, whoever draws its cells. Tailwind
 * reads class names from the source, so each column's is written out.
 */
const RIGHT_CELL_CLASS = [
  "md:[&_td:nth-child(1)]:text-right",
  "md:[&_td:nth-child(2)]:text-right",
  "md:[&_td:nth-child(3)]:text-right",
  "md:[&_td:nth-child(4)]:text-right",
  "md:[&_td:nth-child(5)]:text-right",
  "md:[&_td:nth-child(6)]:text-right",
  "md:[&_td:nth-child(7)]:text-right",
  "md:[&_td:nth-child(8)]:text-right",
] as const;

function rightCellClass(columns: AdminTableColumn[]) {
  return columns.flatMap((column, index) =>
    column.align === "right" ? [RIGHT_CELL_CLASS[index]] : [],
  );
}

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
}: {
  children: React.ReactNode;
  columns: AdminTableColumn[];
}) {
  const phone = phoneColumnLabels(columns);

  const style: CSSPropertiesWithVariables = {
    "--facts-width": factsWidth(columns),
    ...phone.style,
  };

  return (
    <Table
      scrollLabel="Table"
      className={cn(
        CONTROL_CELL_CLASS,
        FIXED_TABLE_CLASS,
        PHONE_ROWS_CLASS,
        phone.className,
        rightCellClass(columns),
      )}
      style={style}
    >
      <AdminTableColumnsHeader columns={columns} />
      {children}
    </Table>
  );
}

function AdminTableColumnHead({ column, sized }: { column: AdminTableColumn; sized: boolean }) {
  const { align, label, sort } = column;

  const className = cn(sized && SIZES[column.size ?? "fact"].className);
  const numeric = align === "right";

  if (!sort) {
    return (
      <TableHead className={className} numeric={numeric}>
        {label}
      </TableHead>
    );
  }

  return (
    <TableHead
      aria-sort={sort.isActive ? "descending" : undefined}
      className={className}
      numeric={numeric}
    >
      <Link
        aria-current={sort.isActive ? "page" : undefined}
        className={cn(
          "hover:text-foreground hit-area relative inline-block w-full text-inherit transition-colors [&>svg]:inline [&>svg]:align-[-0.25em]",
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

function AdminTableColumnsHeader({ columns }: { columns: AdminTableColumn[] }) {
  const fillIndex = fillIndexOf(columns);

  return (
    <TableHeader>
      <TableRow>
        {columns.map((column, index) => (
          <AdminTableColumnHead column={column} key={column.label} sized={index !== fillIndex} />
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
    <AdminTable columns={columns}>
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

export function AdminTableColumnsSkeleton({ columns }: { columns: AdminTableColumn[] }) {
  return (
    <AdminTable columns={columns}>
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
