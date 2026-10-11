import { z } from "zod";
import {
  explanationSchema,
  idSchema,
  optionTextSchema,
  uniqueIdsSchema,
} from "../../steps/contract/content-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import { processIconNames } from "../process-icons";
import { countBonds, isKnownElement, parseMolecularFormula } from "./_utils/chemistry";
import { isBuildableMolecule } from "./_utils/molecule-structure";
import { duplicateIssues, issue } from "./_utils/template-helpers";

const MAX_STEPS = 7;
const MAX_ELEMENTS = 6;
const MAX_FORMULA_LENGTH = 24;

/** Past this many atoms a build no longer fits a phone screen or a few minutes of work. */
const MAX_MOLECULE_ATOMS = 12;

const processStepSchema = z
  .object({
    icon: z.enum(processIconNames).optional(),
    id: idSchema,
    text: optionTextSchema,
    why: explanationSchema.optional(),
  })
  .strict();

export const processOrderTemplate = defineActivityTemplate({
  checks: ["interaction"],
  description:
    "Arrange the steps of a process in order, like photosynthesis, and learn why each needs the one before. Steps are written in their true order; the player shuffles them. Fills: the steps, an icon for each from the allowed Lucide names and why each step comes after the previous one.",
  expected: (fields) => ({ ids: fields.steps.map((step) => step.id), kind: "order" }),
  fields: z
    .object({ steps: uniqueIdsSchema(processStepSchema, { max: MAX_STEPS, min: 3 }) })
    .strict(),
  id: "processOrder",
  needsData: false,
  verify: (fields) =>
    fields.steps
      .slice(1)
      .filter((step) => !step.why)
      .map((step) =>
        issue("inconsistentFields", "fields.steps", `Step "${step.id}" needs a why for its place`),
      ),
});

const moleculeFields = z
  .object({
    elements: z
      .array(z.string().regex(/^[A-Z][a-z]?$/u))
      .min(1)
      .max(MAX_ELEMENTS),
    formula: z.string().min(1).max(MAX_FORMULA_LENGTH),
  })
  .strict();

function atomCount(counts: Readonly<Record<string, number>>): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

function moleculeIssues(fields: z.output<typeof moleculeFields>) {
  const counts = parseMolecularFormula(fields.formula);

  if (!counts) {
    return [issue("inconsistentFields", "fields.formula", "The formula can't be read")];
  }

  if (atomCount(counts) > MAX_MOLECULE_ATOMS) {
    return [
      issue(
        "inconsistentFields",
        "fields.formula",
        `Pick a molecule with at most ${MAX_MOLECULE_ATOMS} atoms, so it can be built on a phone`,
      ),
    ];
  }

  return [
    ...duplicateIssues(fields.elements, "fields.elements", "Element"),
    ...fields.elements
      .filter((element) => !isKnownElement(element))
      .map((element) =>
        issue("inconsistentFields", "fields.elements", `Unknown element "${element}"`),
      ),
    ...Object.keys(counts)
      .filter((element) => !fields.elements.includes(element))
      .map((element) =>
        issue("inconsistentFields", "fields.elements", `"${element}" isn't offered`),
      ),
    ...(isBuildableMolecule(counts)
      ? []
      : [
          issue(
            "inconsistentFields",
            "fields.formula",
            "The formula can't be built with every bond filled and at most triple bonds",
          ),
        ]),
  ];
}

export const moleculeBuilderTemplate = defineActivityTemplate({
  checks: ["interaction", "choice", "numeric"],
  description:
    "Connect atoms until every bond is filled, like carbon dioxide. Code knows how many bonds each element makes (B, Br, C, Cl, F, H, I, N, O, P, S, Si) and accepts any complete structure with the formula's atoms. Keep it to 12 atoms or fewer. The computed number is the bond count (a double bond counts twice). Fills: the target formula, the elements offered (an extra one makes the learner think) and the check question.",
  expected: (fields) => {
    const elements = parseMolecularFormula(fields.formula);
    return elements ? { elements, kind: "molecule" } : null;
  },
  fields: moleculeFields,
  id: "moleculeBuilder",
  needsData: false,
  value: (fields) => {
    const counts = parseMolecularFormula(fields.formula);
    return counts ? countBonds(counts) : null;
  },
  verify: (fields) => moleculeIssues(fields),
});
