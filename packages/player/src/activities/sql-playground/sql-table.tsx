"use client";

import { type ActivityCell } from "@zoonk/core/library/activities/expected-answer";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDown, Table2 } from "lucide-react";
import { useExtracted } from "next-intl";
import { keyedByPosition } from "../_utils/position-keys";
import { useFormatNumber } from "../_utils/use-format-number";

type RowState = "extra" | "missing" | "plain" | "right";

/** SQL's own word, never translated. */
const NULL_TEXT = "NULL";

/** Numbers right-aligned without grouping, the way a query result prints them. */
function Cell({ value }: { value: ActivityCell }) {
  const format = useFormatNumber();

  if (value === null) {
    return <span className="text-muted-foreground italic">{NULL_TEXT}</span>;
  }

  return typeof value === "number" ? format(value, { grouping: false }) : value;
}

function SqlRow({ row, state }: { row: readonly ActivityCell[]; state: RowState }) {
  const t = useExtracted();
  const cells = keyedByPosition(row, (value) => String(value));

  return (
    <tr
      className={cn(
        "border-t",
        state === "extra" && "bg-destructive/10",
        state === "missing" && "bg-success/10",
      )}
    >
      {cells.map(({ item, key }, position) => (
        <td
          className={cn(
            "px-3.5 py-2 whitespace-nowrap",
            typeof item === "number" && "text-right tabular-nums",
          )}
          key={key}
        >
          <Cell value={item} />
          {position === cells.length - 1 && state === "extra" && (
            <span className="sr-only">{`, ${t("not expected")}`}</span>
          )}
          {position === cells.length - 1 && state === "missing" && (
            <span className="sr-only">{`, ${t("missing from your result")}`}</span>
          )}
        </td>
      ))}
    </tr>
  );
}

/**
 * Rows in a table: the lesson's data, the learner's result or the expected result. After the
 * check, rows the result shouldn't have and rows it's missing are marked.
 */
export function SqlRowsTable({
  caption,
  columns,
  rowStates,
  rows,
}: {
  caption: string;
  columns: readonly string[];
  rowStates?: readonly RowState[];
  rows: readonly (readonly ActivityCell[])[];
}) {
  return (
    <div
      aria-label={caption}
      className="bg-background focus-visible:ring-ring/50 overflow-x-auto rounded-2xl border outline-none focus-visible:ring-[3px]"
      role="region"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- A wide table scrolls sideways, which needs focus by keyboard.
      tabIndex={0}
    >
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/60 text-muted-foreground font-mono text-xs">
          <tr>
            {keyedByPosition(columns, (column) => column).map(({ item, key }) => (
              <th
                className="px-3.5 py-1.5 text-left font-normal whitespace-nowrap"
                key={key}
                scope="col"
              >
                {item}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {keyedByPosition(rows, (row) => JSON.stringify(row)).map(({ item, key }, position) => (
            <SqlRow key={key} row={item} state={rowStates?.[position] ?? "plain"} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Table = {
  columns: readonly { name: string; type: string }[];
  name: string;
  rows: readonly (readonly ActivityCell[])[];
};

const OPEN_ROW_LIMIT = 6;

/** One of the lesson's tables: its name and columns, opening to show its rows. */
export function SqlTableViewer({ table }: { table: Table }) {
  const t = useExtracted();

  return (
    <details
      className="group bg-background rounded-2xl border"
      open={table.rows.length <= OPEN_ROW_LIMIT}
    >
      <summary className="focus-visible:ring-ring/50 flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-2xl px-3.5 py-2 outline-none focus-visible:ring-[3px] [&::-webkit-details-marker]:hidden">
        <Table2 aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        <span className="font-mono text-sm font-semibold">{table.name}</span>
        <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs">
          {table.columns.map((column) => column.name).join(", ")}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {t("{count, plural, one {# row} other {# rows}}", { count: table.rows.length })}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0 group-open:rotate-180 motion-safe:transition-transform"
        />
      </summary>

      <div className="px-2 pb-2">
        <SqlRowsTable
          caption={t("Table {name}", { name: table.name })}
          columns={table.columns.map((column) => column.name)}
          rows={table.rows}
        />
      </div>
    </details>
  );
}
