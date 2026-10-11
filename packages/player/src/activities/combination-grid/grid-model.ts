import { cellMatches, genotype } from "@zoonk/core/library/activities/combination-grid";
import { type ActivityContentFor } from "@zoonk/core/library/activities/templates";

export type GridFields = ActivityContentFor<"combinationGrid">["fields"];

/** A cell of the grid: the row value and the column value it combines. */
export type GridCell = { column: string; columnIndex: number; row: string; rowIndex: number };

/** The learner's value in each cell, row by row, or null while it's empty. */
export type GridFill = readonly (string | null)[];

/** Cells row by row, as core grades them: each row value with each column value. */
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

/**
 * What can go in a cell: the three genotypes one gene can make, dominant first ("PP", "Pp",
 * "pp"), or every value the numbers combine to, smallest first.
 */
export function cellOptions(fields: GridFields, expected: readonly string[]): string[] {
  if (fields.rule === "alleles") {
    const letter = fields.rows.values[0] ?? "";
    const [dominant, recessive] = [letter.toUpperCase(), letter.toLowerCase()];

    return [dominant + dominant, genotype(dominant, recessive), recessive + recessive];
  }

  return [...new Set(expected)].toSorted((first, second) => Number(first) - Number(second));
}

/** Whether two cell values are the same: genotypes in either order, numbers as written. */
export function sameCell(first: string, second: string): boolean {
  return /^[A-Za-z]{2}$/u.test(first) && /^[A-Za-z]{2}$/u.test(second)
    ? genotype(first.charAt(0), first.charAt(1)) === genotype(second.charAt(0), second.charAt(1))
    : first.trim() === second.trim();
}

/** The first empty cell after `after`, wrapping around, or null when the grid is full. */
export function nextEmptyCell(fill: GridFill, after: number | null): number | null {
  const start = after === null ? 0 : after + 1;

  const index = [...fill.keys()]
    .map((offset) => (start + offset) % fill.length)
    .find((cell) => fill[cell] === null);

  return index ?? null;
}

/** The values once every cell is filled; null while any is empty. */
export function completeFill(fill: GridFill): string[] | null {
  const filled = fill.filter((cell) => cell !== null);
  return filled.length === fill.length ? filled : null;
}

/**
 * The share of cells that count toward `output` ("recessive", "dominant", a genotype or a value),
 * the way core computes a numeric answer, or null while any cell is empty.
 */
export function fillShare(fill: GridFill, output: string): number | null {
  const cells = completeFill(fill);

  if (!cells || cells.length === 0) {
    return null;
  }

  return cells.filter((cell) => cellMatches(cell, output)).length / cells.length;
}

/** How many filled cells show each trait, for the tally under a Punnett grid. */
export function traitCounts(fill: GridFill): { dominant: number; recessive: number } {
  const cells = fill.filter((cell) => cell !== null);
  const dominant = cells.filter((cell) => cellMatches(cell, "dominant")).length;

  return { dominant, recessive: cells.length - dominant };
}
