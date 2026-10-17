import { z } from "zod";
import { labelSchema } from "../../steps/contract/content-schemas";
import { type ActivityCheckKind } from "../activity-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import { isClose, issue } from "./_utils/template-helpers";

const MAX_VALUES = 6;
/** Past this many cells, filling every one by hand is busywork: ask about the grid instead. */
const MAX_FILLED_CELLS = 9;

const alleleSchema = z.string().regex(/^[A-Za-z]$/u);

const alleleSideSchema = z
  .object({ label: labelSchema, values: z.array(alleleSchema).length(2) })
  .strict();

const numberSideSchema = z
  .object({ label: labelSchema, values: z.array(z.number()).min(1).max(MAX_VALUES) })
  .strict();

const numberGrid = {
  columns: numberSideSchema,
  rows: numberSideSchema,
  /** What the grid shows, like "Two dice". */
  title: labelSchema,
};

/**
 * How each cell combines its row and its column: two parents' alleles (a Punnett square, with
 * what each genotype shows), or two numbers added or multiplied (two dice, a times table).
 */
const combinationGridFields = z.discriminatedUnion("rule", [
  z
    .object({
      columns: alleleSideSchema,
      rows: alleleSideSchema,
      rule: z.literal("alleles"),
      /** The trait the gene sets, like "Flower color". */
      title: labelSchema,
      traits: z.object({ dominant: labelSchema, recessive: labelSchema }).strict(),
    })
    .strict(),
  z.object({ ...numberGrid, rule: z.literal("sum") }).strict(),
  z.object({ ...numberGrid, rule: z.literal("product") }).strict(),
]);

type CombinationGridFields = z.output<typeof combinationGridFields>;

/** Writes a genotype the standard way, dominant allele first: "pP" becomes "Pp". */
export function genotype(first: string, second: string): string {
  return [first, second].toSorted().join("");
}

/** A genotype shows the dominant trait when it has at least one uppercase allele. */
export function isDominantPhenotype(cell: string): boolean {
  return cell !== cell.toLowerCase();
}

function combine(fields: CombinationGridFields, row: string | number, column: string | number) {
  if (fields.rule === "alleles") {
    return genotype(String(row), String(column));
  }

  return String(
    fields.rule === "sum" ? Number(row) + Number(column) : Number(row) * Number(column),
  );
}

/** Every cell, row by row: each row value combined with each column value by the grid's rule. */
function gridCells(fields: CombinationGridFields): string[] {
  const columns: readonly (string | number)[] = fields.columns.values;

  return fields.rows.values.flatMap((row: string | number) =>
    columns.map((column) => combine(fields, row, column)),
  );
}

/**
 * Whether a cell counts toward a check's `output`. Alleles: "dominant", "recessive" or a genotype
 * like "Pp". Numbers: the cell's value, like "7".
 */
export function cellMatches(cell: string, output: string): boolean {
  if (output === "dominant") {
    return isDominantPhenotype(cell);
  }

  if (output === "recessive") {
    return !isDominantPhenotype(cell);
  }

  if (output.length === 2 && /^[A-Za-z]{2}$/u.test(output)) {
    return cell === genotype(output.charAt(0), output.charAt(1));
  }

  const number = Number(output);
  return Number.isFinite(number) && isClose(Number(cell), number);
}

/** What a check counts when it names nothing: the recessive trait on a Punnett square. */
function defaultOutput(fields: CombinationGridFields): string | null {
  return fields.rule === "alleles" ? "recessive" : null;
}

function shareOf(fields: CombinationGridFields, output: string | null): number | null {
  if (output === null) {
    return null;
  }

  const cells = gridCells(fields);
  return cells.filter((cell) => cellMatches(cell, output)).length / cells.length;
}

/** Whether the learner fills the grid by hand; a bigger one is shown filled, to read. */
export function isFillable(fields: CombinationGridFields): boolean {
  return gridCells(fields).length <= MAX_FILLED_CELLS;
}

function checksFor(fields: CombinationGridFields): readonly ActivityCheckKind[] {
  return isFillable(fields) ? ["interaction", "choice", "numeric"] : ["choice", "numeric"];
}

export const combinationGridTemplate = defineActivityTemplate({
  checks: ["interaction", "choice", "numeric"],
  checksFor,
  description:
    'A grid where every cell combines its row and its column, filled by code: two parents\' alleles (`rule` "alleles", a Punnett square like Mendel\'s peas, one gene and one letter, the uppercase allele dominant, with what each genotype shows in `traits`) or two numbers added or multiplied (`rule` "sum" or "product", like the 36 outcomes of two dice or a times table). On a grid of 9 cells or fewer the learner fills every cell before answering, whatever the check (an interaction check grades the fill itself); a larger grid is shown filled, to read. The computed number is the share of cells (0 to 1) matching `output`: "recessive" (default), "dominant" or a genotype like "Pp" for alleles, a cell value like "7" for numbers. Fills: the title, the rows and columns with their labels and values, the traits for alleles and the check question.',
  expected: (fields) => ({ cells: gridCells(fields), kind: "grid" }),
  fields: combinationGridFields,
  id: "combinationGrid",
  needsData: false,
  value: (fields, target) => shareOf(fields, target.output ?? defaultOutput(fields)),
  verify: (fields) => {
    if (fields.rule !== "alleles") {
      return gridCells(fields).length < 2
        ? [issue("missingInteraction", "fields", "A grid of one cell has nothing to combine")]
        : [];
    }

    const letters = new Set(
      [...fields.rows.values, ...fields.columns.values].map((allele) => allele.toLowerCase()),
    );

    return letters.size === 1
      ? []
      : [issue("inconsistentFields", "fields.rows", "Both parents must use one gene's letter")];
  },
});
