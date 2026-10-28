"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type GridCell, type GridFill, sameCell } from "./grid-model";
import { CellValue, GridHeader, type GridTraits, Trait } from "./grid-parts";

type GridChecked = { counted: ReadonlySet<number>; expected: readonly string[] };

const ROOMY_COLUMNS = 3;

function CheckedCell({
  counted,
  expected,
  isAllele,
  isCompact,
  learner,
  traits,
}: {
  counted: boolean;
  expected: string;
  isAllele: boolean;
  isCompact: boolean;
  learner: string | null;
  traits: GridTraits;
}) {
  const t = useExtracted();
  const isWrong = learner !== null && !sameCell(learner, expected);

  return (
    <div
      className={cn(
        "bg-background flex flex-col items-center justify-center gap-0.5 rounded-xl border px-1",
        isCompact ? "min-h-11 py-1" : "min-h-18 py-2",
        learner !== null && !isWrong && "border-success/60",
        isWrong && "border-destructive/60 bg-destructive/5",
        counted && "bg-viz-highlight-soft",
      )}
    >
      <CellValue
        className={isCompact ? "text-sm" : "text-lg"}
        isAllele={isAllele}
        value={expected}
      />
      <Trait traits={traits} value={expected} />

      {isWrong && (
        <span className="text-destructive-text text-xs line-through">
          <span className="sr-only">{t("Your answer:")} </span>
          {learner}
        </span>
      )}
    </div>
  );
}

function CellButton({
  cell,
  isActive,
  isAllele,
  isCompact,
  number,
  onSelect,
  traits,
  value,
}: {
  cell: GridCell;
  isActive: boolean;
  isAllele: boolean;
  isCompact: boolean;
  number: number;
  onSelect: () => void;
  traits: GridTraits;
  value: string | null;
}) {
  const t = useExtracted();
  const place = { column: cell.column, number: String(number), row: cell.row };

  return (
    <button
      aria-label={value ? undefined : t("Square {number}, {row} and {column}: empty", place)}
      aria-pressed={isActive}
      className={cn(
        "bg-background focus-visible:ring-ring/50 hover:bg-accent flex flex-col items-center justify-center gap-0.5 rounded-xl border outline-none focus-visible:ring-[3px] motion-safe:transition-[border-color,box-shadow]",
        isCompact ? "min-h-11" : "min-h-18",
        !value && "border-dashed",
        isActive && "border-viz-accent ring-viz-accent/25 ring-4",
      )}
      onClick={onSelect}
      type="button"
    >
      {value && (
        <>
          <span className="sr-only">{t("Square {number}, {row} and {column}:", place)}</span>
          <CellValue
            className={isCompact ? "text-sm" : "text-lg"}
            isAllele={isAllele}
            value={value}
          />
          <Trait traits={traits} value={value} />
        </>
      )}
    </button>
  );
}

export function GridBoard({
  activeCell,
  cells,
  checked,
  columnLabel,
  fill,
  isAllele,
  onSelectCell,
  rowLabel,
  traits,
}: {
  activeCell: number | null;
  cells: readonly GridCell[];
  checked: GridChecked | null;
  columnLabel: string;
  fill: GridFill;
  isAllele: boolean;
  onSelectCell: ((index: number) => void) | null;
  rowLabel: string;
  traits: GridTraits;
}) {
  const active = activeCell === null ? null : cells[activeCell];
  const columns = cells.filter((cell) => cell.rowIndex === 0);
  const isCompact = columns.length > ROOMY_COLUMNS;

  return (
    <div
      className="grid gap-2"
      style={{
        gridTemplateColumns: `${isCompact ? "3rem" : "4.5rem"} repeat(${columns.length}, minmax(0, 1fr))`,
      }}
    >
      <span aria-hidden="true" />
      <p
        className="text-muted-foreground text-center text-xs"
        style={{ gridColumn: `span ${columns.length}` }}
      >
        {columnLabel}
      </p>

      <p className="text-muted-foreground flex items-end justify-center pb-1 text-center text-xs leading-tight">
        {rowLabel}
      </p>

      {columns.map((cell) => (
        <GridHeader
          isAllele={isAllele}
          isLit={active?.columnIndex === cell.columnIndex}
          key={`column-${cell.columnIndex}`}
          value={cell.column}
        />
      ))}

      {cells.map((cell, index) => (
        <div className="contents" key={`${cell.rowIndex}-${cell.columnIndex}`}>
          {cell.columnIndex === 0 && (
            <GridHeader
              isAllele={isAllele}
              isLit={active?.rowIndex === cell.rowIndex}
              value={cell.row}
            />
          )}

          {checked || !onSelectCell ? (
            <CheckedCell
              counted={checked?.counted.has(index) ?? false}
              expected={checked?.expected[index] ?? fill[index] ?? ""}
              isAllele={isAllele}
              isCompact={isCompact}
              learner={checked ? (fill[index] ?? null) : null}
              traits={traits}
            />
          ) : (
            <CellButton
              cell={cell}
              isActive={activeCell === index}
              isAllele={isAllele}
              isCompact={isCompact}
              number={index + 1}
              onSelect={() => onSelectCell(index)}
              traits={traits}
              value={fill[index] ?? null}
            />
          )}
        </div>
      ))}
    </div>
  );
}
