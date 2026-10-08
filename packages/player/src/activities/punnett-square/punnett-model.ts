import { cellMatches, genotype } from "@zoonk/core/library/activities/punnett-square";

type Parent = { alleles: readonly string[]; label: string };

/** A square of the grid: the allele it gets from each parent. */
export type PunnettCell = { column: string; columnIndex: number; row: string; rowIndex: number };

/** The learner's genotype in each square, row by row, or null while it's empty. */
export type PunnettFill = readonly (string | null)[];

/** Squares row by row, as core grades them: rows are the first parent's alleles. */
export function punnettCells(parents: readonly Parent[]): PunnettCell[] {
  const [rows = [], columns = []] = parents.map((parent) => parent.alleles);

  return rows.flatMap((row, rowIndex) =>
    columns.map((column, columnIndex) => ({ column, columnIndex, row, rowIndex })),
  );
}

/** The three genotypes one gene can make, dominant first: "PP", "Pp", "pp". */
export function genotypeOptions(parents: readonly Parent[]): string[] {
  const letter = parents[0]?.alleles[0] ?? "";
  const [dominant, recessive] = [letter.toUpperCase(), letter.toLowerCase()];

  return [dominant + dominant, genotype(dominant, recessive), recessive + recessive];
}

/** The first empty square after `after`, wrapping around, or null when the square is full. */
export function nextEmptyCell(fill: PunnettFill, after: number | null): number | null {
  const start = after === null ? 0 : after + 1;

  const index = [...fill.keys()]
    .map((offset) => (start + offset) % fill.length)
    .find((cell) => fill[cell] === null);

  return index ?? null;
}

/** The genotypes once every square is filled; null while any is empty. */
export function completeFill(fill: PunnettFill): string[] | null {
  const filled = fill.filter((cell) => cell !== null);
  return filled.length === fill.length ? filled : null;
}

/**
 * The share of squares that count toward `output` ("recessive", "dominant" or a genotype), the
 * way core computes a numeric answer, or null while any square is empty.
 */
export function fillShare(fill: PunnettFill, output: string): number | null {
  const cells = completeFill(fill);

  if (!cells || cells.length === 0) {
    return null;
  }

  return cells.filter((cell) => cellMatches(cell, output)).length / cells.length;
}

/** How many filled squares show each trait, for the tally under the grid. */
export function traitCounts(fill: PunnettFill): { dominant: number; recessive: number } {
  const cells = fill.filter((cell) => cell !== null);
  const dominant = cells.filter((cell) => cellMatches(cell, "dominant")).length;

  return { dominant, recessive: cells.length - dominant };
}
