"use client";

import { genotype } from "@zoonk/core/library/activities/punnett-square";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type PunnettCell, type PunnettFill } from "./punnett-model";
import { AlleleHeader, Genotype, Trait } from "./punnett-parts";

type Phenotypes = { dominant: string; recessive: string };
type Parent = { alleles: readonly string[]; label: string };

/** After the check: the right genotypes, and which squares the check's question counts. */
type PunnettChecked = { counted: ReadonlySet<number>; expected: readonly string[] };

function CheckedCell({
  counted,
  expected,
  learner,
  phenotypes,
}: {
  counted: boolean;
  expected: string;
  learner: string | null;
  phenotypes: Phenotypes;
}) {
  const t = useExtracted();
  const isWrong = learner !== null && genotype(learner.charAt(0), learner.charAt(1)) !== expected;

  return (
    <div
      className={cn(
        "bg-background flex min-h-18 flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 py-2",
        learner !== null && !isWrong && "border-success/60",
        isWrong && "border-destructive/60 bg-destructive/5",
        counted && "bg-viz-highlight-soft",
      )}
    >
      <Genotype className="text-lg" value={expected} />
      <Trait phenotypes={phenotypes} value={expected} />

      {isWrong && (
        <span className="text-destructive text-xs line-through">
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
  number,
  onSelect,
  phenotypes,
  value,
}: {
  cell: PunnettCell;
  isActive: boolean;
  number: number;
  onSelect: () => void;
  phenotypes: Phenotypes;
  value: string | null;
}) {
  const t = useExtracted();
  const alleles = { column: cell.column, number: String(number), row: cell.row };

  return (
    <button
      aria-label={
        value
          ? t("Square {number}, {row} and {column}: {value}", { ...alleles, value })
          : t("Square {number}, {row} and {column}: empty", alleles)
      }
      aria-pressed={isActive}
      className={cn(
        "bg-background focus-visible:ring-ring/50 hover:bg-accent flex min-h-18 flex-col items-center justify-center gap-0.5 rounded-2xl border outline-none focus-visible:ring-[3px] motion-safe:transition-[border-color,box-shadow]",
        !value && "border-dashed",
        isActive && "border-viz-accent ring-viz-accent/25 ring-4",
      )}
      onClick={onSelect}
      type="button"
    >
      {value && (
        <>
          <Genotype className="text-lg" value={value} />
          <Trait phenotypes={phenotypes} value={value} />
        </>
      )}
    </button>
  );
}

/**
 * The square: the second parent's alleles across the top, the first parent's down the side, and
 * one square for each pairing. The square being filled lights up the two alleles it combines.
 */
export function PunnettGrid({
  activeCell,
  cells,
  checked,
  fill,
  onSelectCell,
  parents,
  phenotypes,
}: {
  activeCell: number | null;
  cells: readonly PunnettCell[];
  checked: PunnettChecked | null;
  fill: PunnettFill;
  onSelectCell: (index: number) => void;
  parents: readonly Parent[];
  phenotypes: Phenotypes;
}) {
  const [rowParent, columnParent] = parents;
  const active = activeCell === null ? null : cells[activeCell];

  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-2">
      <span aria-hidden="true" />
      <p className="text-muted-foreground col-span-2 text-center text-xs">{columnParent?.label}</p>

      <p className="text-muted-foreground flex items-end justify-center pb-1 text-center text-xs leading-tight">
        {rowParent?.label}
      </p>

      {cells
        .filter((cell) => cell.rowIndex === 0)
        .map((cell) => (
          <AlleleHeader
            allele={cell.column}
            isLit={active?.columnIndex === cell.columnIndex}
            key={`column-${cell.columnIndex}`}
          />
        ))}

      {cells.map((cell, index) => (
        <div className="contents" key={`${cell.rowIndex}-${cell.columnIndex}`}>
          {cell.columnIndex === 0 && (
            <AlleleHeader allele={cell.row} isLit={active?.rowIndex === cell.rowIndex} />
          )}

          {checked ? (
            <CheckedCell
              counted={checked.counted.has(index)}
              expected={checked.expected[index] ?? ""}
              learner={fill[index] ?? null}
              phenotypes={phenotypes}
            />
          ) : (
            <CellButton
              cell={cell}
              isActive={activeCell === index}
              number={index + 1}
              onSelect={() => onSelectCell(index)}
              phenotypes={phenotypes}
              value={fill[index] ?? null}
            />
          )}
        </div>
      ))}
    </div>
  );
}
