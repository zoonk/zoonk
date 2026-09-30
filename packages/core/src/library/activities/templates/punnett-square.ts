import { z } from "zod";
import { labelSchema } from "../../steps/contract/content-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import { issue } from "./_utils/template-helpers";

const alleleSchema = z.string().regex(/^[A-Za-z]$/u);

const parentSchema = z
  .object({ alleles: z.array(alleleSchema).length(2), label: labelSchema })
  .strict();

const punnettFields = z
  .object({
    parents: z.array(parentSchema).length(2),
    phenotypes: z.object({ dominant: labelSchema, recessive: labelSchema }).strict(),
    trait: labelSchema,
  })
  .strict();

type PunnettFields = z.output<typeof punnettFields>;

/** Writes a genotype the standard way, dominant allele first: "pP" becomes "Pp". */
export function genotype(first: string, second: string): string {
  return [first, second].toSorted().join("");
}

/** Cells row by row: rows are the first parent's alleles, columns the second's. */
function punnettCells(fields: PunnettFields): string[] {
  const [rows, columns] = fields.parents.map((parent) => parent.alleles);

  return (rows ?? []).flatMap((row) => (columns ?? []).map((column) => genotype(row, column)));
}

/** A genotype shows the dominant trait when it has at least one uppercase allele. */
export function isDominantPhenotype(cell: string): boolean {
  return cell !== cell.toLowerCase();
}

/** Whether a cell counts toward a check's `output`: "dominant", "recessive" or a genotype. */
export function cellMatches(cell: string, output: string): boolean {
  if (output === "dominant") {
    return isDominantPhenotype(cell);
  }

  if (output === "recessive") {
    return !isDominantPhenotype(cell);
  }

  return cell === genotype(output.charAt(0), output.charAt(1));
}

function shareOf(fields: PunnettFields, output: string): number | null {
  const isKnownOutput = output === "dominant" || output === "recessive" || output.length === 2;

  if (!isKnownOutput) {
    return null;
  }

  const cells = punnettCells(fields);

  return cells.filter((cell) => cellMatches(cell, output)).length / cells.length;
}

export const punnettSquareTemplate = defineActivityTemplate({
  checks: ["interaction", "choice", "numeric"],
  description:
    'Combine two parents\' alleles in a grid to predict their offspring, like Mendel\'s peas. One gene, one letter: the uppercase allele is dominant. Code fills the grid; the computed share is for `output` "recessive" (default), "dominant" or a genotype like "Pp". Fills: the trait, each parent\'s two alleles, the two phenotypes and the check question.',
  expected: (fields) => ({ cells: punnettCells(fields), kind: "grid" }),
  fields: punnettFields,
  id: "punnettSquare",
  needsData: false,
  value: (fields, target) => shareOf(fields, target.output ?? "recessive"),
  verify: (fields) => {
    const letters = new Set(
      fields.parents.flatMap((parent) => parent.alleles.map((allele) => allele.toLowerCase())),
    );

    return letters.size === 1
      ? []
      : [issue("inconsistentFields", "fields.parents", "Both parents must use one gene's letter")];
  },
});
