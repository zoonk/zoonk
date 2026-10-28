import { cellMatches, genotype } from "@zoonk/core/library/activities/combination-grid";
import { type ActivityContentFor } from "@zoonk/core/library/activities/templates";

export type GridFields = ActivityContentFor<"combinationGrid">["fields"];

export type GridCell = { column: string; columnIndex: number; row: string; rowIndex: number };

export type GridFill = readonly (string | null)[];

export function gridCells(fields: GridFields): GridCell[] {
  const columns: readonly (string | number)[] = fields.columns.values;

  return fields.rows.values.flatMap((row: string | number, rowIndex) =>
    columns.map((column, columnIndex) => ({
      column: String(column),
      columnIndex,
      row: String(row),
      rowIndex,
    })),
  );
}

export function cellOptions(fields: GridFields, expected: readonly string[]): string[] {
  if (fields.rule === "alleles") {
    const letter = fields.rows.values[0] ?? "";
    const [dominant, recessive] = [letter.toUpperCase(), letter.toLowerCase()];

    return [dominant + dominant, genotype(dominant, recessive), recessive + recessive];
  }

  return [...new Set(expected)].toSorted((first, second) => Number(first) - Number(second));
}

export function sameCell(first: string, second: string): boolean {
  return /^[A-Za-z]{2}$/u.test(first) && /^[A-Za-z]{2}$/u.test(second)
    ? genotype(first.charAt(0), first.charAt(1)) === genotype(second.charAt(0), second.charAt(1))
    : first.trim() === second.trim();
}

export function nextEmptyCell(fill: GridFill, after: number | null): number | null {
  const start = after === null ? 0 : after + 1;

  const index = [...fill.keys()]
    .map((offset) => (start + offset) % fill.length)
    .find((cell) => fill[cell] === null);

  return index ?? null;
}

export function completeFill(fill: GridFill): string[] | null {
  const filled = fill.filter((cell) => cell !== null);
  return filled.length === fill.length ? filled : null;
}

export function fillShare(fill: GridFill, output: string): number | null {
  const cells = completeFill(fill);

  if (!cells || cells.length === 0) {
    return null;
  }

  return cells.filter((cell) => cellMatches(cell, output)).length / cells.length;
}

export function traitCounts(fill: GridFill): { dominant: number; recessive: number } {
  const cells = fill.filter((cell) => cell !== null);
  const dominant = cells.filter((cell) => cellMatches(cell, "dominant")).length;

  return { dominant, recessive: cells.length - dominant };
}
