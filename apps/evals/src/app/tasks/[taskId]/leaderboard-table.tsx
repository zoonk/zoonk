"use client";

import {
  type SortDirection,
  type SortKey,
  type SortableEntry,
  getDefaultSortDirection,
  sortLeaderboardEntries,
} from "@/lib/leaderboard-sort";
import { NUMBER_CELL_CLASS, NUMBER_HEAD_CLASS } from "@/lib/table-classes";
import { Button } from "@zoonk/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowDownIcon, ArrowUpIcon, Columns3Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export type LeaderboardColumn<Entry> = {
  cell: (entry: Entry, index: number) => React.ReactNode;
  cellClassName?: (entry: Entry) => string | undefined;
  id: string;
  isNumber?: boolean;
  label: React.ReactNode;
  sortKey?: SortKey;
  title?: string;
};

export function ModelLink({
  children,
  modelId,
  taskId,
}: React.PropsWithChildren<{ modelId: string; taskId: string }>) {
  return (
    <Link
      className="-my-2 inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline"
      href={`/tasks/${taskId}/${encodeURIComponent(modelId)}`}
    >
      {children}
    </Link>
  );
}

/** A number column keeps its label on the numbers' edge, so its arrow goes before the label. */
function ColumnHead<Entry>({
  column,
  direction,
  isSorted,
  onSort,
}: {
  column: LeaderboardColumn<Entry>;
  direction: SortDirection;
  isSorted: boolean;
  onSort: (key: SortKey) => void;
}) {
  const { isNumber, label, sortKey, title } = column;

  if (!sortKey) {
    return (
      <TableHead className={cn(isNumber && NUMBER_HEAD_CLASS)} title={title}>
        {label}
      </TableHead>
    );
  }

  const Arrow = direction === "asc" ? ArrowUpIcon : ArrowDownIcon;
  const arrow = isSorted && <Arrow aria-hidden="true" className="size-3.5" />;

  return (
    <TableHead
      aria-sort={isSorted ? `${direction}ending` : undefined}
      className={cn(isNumber && NUMBER_HEAD_CLASS)}
      title={title}
    >
      <button
        className={cn(
          "hit-area relative flex w-full cursor-pointer items-center gap-1",
          isNumber && "justify-end",
        )}
        onClick={() => onSort(sortKey)}
        type="button"
      >
        {isNumber && arrow}
        {label}
        {!isNumber && arrow}
      </button>
    </TableHead>
  );
}

/**
 * Both of a task's leaderboards: models sorted by a column, with the less-used columns behind
 * "More columns". `renderActions` gets the rows in the order shown, for an export.
 */
export function LeaderboardTable<Entry extends SortableEntry & { modelId: string }>({
  columns,
  description,
  entries,
  footer,
  moreColumns,
  renderActions,
}: {
  columns: LeaderboardColumn<Entry>[];
  description: string;
  entries: Entry[];
  footer?: React.ReactNode;
  moreColumns: LeaderboardColumn<Entry>[];
  renderActions?: (sortedEntries: Entry[]) => React.ReactNode;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("averageScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showsMore, setShowsMore] = useState(false);

  const sortedEntries = sortLeaderboardEntries(entries, sortKey, sortDirection);
  const shownColumns = showsMore ? [...columns, ...moreColumns] : columns;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(getDefaultSortDirection(key));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">{description}</p>

        <div className="flex items-center gap-2">
          <Button
            aria-pressed={showsMore}
            icon={<Columns3Icon />}
            onClick={() => setShowsMore((shown) => !shown)}
            size="sm"
            variant="outline"
          >
            {showsMore ? "Fewer columns" : "More columns"}
          </Button>
          {renderActions?.(sortedEntries)}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {shownColumns.map((column) => (
              <ColumnHead
                column={column}
                direction={sortDirection}
                isSorted={column.sortKey === sortKey}
                key={column.id}
                onSort={handleSort}
              />
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {sortedEntries.map((entry, index) => (
            <TableRow key={entry.modelId}>
              {shownColumns.map((column) => (
                <TableCell
                  className={cn(
                    column.isNumber && NUMBER_CELL_CLASS,
                    column.cellClassName?.(entry),
                  )}
                  key={column.id}
                >
                  {column.cell(entry, index)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {footer}
    </div>
  );
}
