import { z } from "zod";
import {
  explanationSchema,
  idSchema,
  labelSchema,
  optionTextSchema,
  uniqueIdsSchema,
} from "../../steps/contract/content-schemas";
import { identifierSchema, outputSchema, slugSchema, variableSchema } from "../activity-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import { describeDiagrams, getDiagramParts } from "../diagrams";
import { processIconNames } from "../process-icons";
import { countBonds, isKnownElement, parseMolecularFormula } from "./_utils/chemistry";
import { computeOutput, formulaModelIssues, outputFormulas } from "./_utils/formula-model";
import { isBuildableMolecule } from "./_utils/molecule-structure";
import { duplicateIssues, issue } from "./_utils/template-helpers";

const MAX_VARIABLES = 3;
const MAX_OUTPUTS = 4;
const MAX_PARTS = 8;
const MAX_DISTRACTORS = 3;
const MAX_MIX_UPS = 4;
const MAX_STEPS = 7;
const MAX_ELEMENTS = 6;
const MAX_FORMULA_LENGTH = 24;

/** Past this many atoms a build no longer fits a phone screen or a few minutes of work. */
const MAX_MOLECULE_ATOMS = 12;

const parameterSimulationFields = z
  .object({
    model: labelSchema,
    outputs: uniqueIdsSchema(outputSchema, { max: MAX_OUTPUTS, min: 1 }),
    plot: z.object({ x: identifierSchema, y: idSchema }).strict(),
    variables: z.array(variableSchema).min(1).max(MAX_VARIABLES),
  })
  .strict();

export const parameterSimulationTemplate = defineActivityTemplate({
  checks: ["choice", "numeric"],
  description:
    "Move a model's parameters and watch the result: projectile, pendulum, circuit, gas law, waves, orbits or population. A numeric check reads `output` (default: the plotted output) with the sliders at `inputs`. Fills: formulas, variables with ranges and units, what to plot and the check question.",
  fields: parameterSimulationFields,
  formulas: (fields) => outputFormulas(fields),
  id: "parameterSimulation",
  needsData: false,
  value: (fields, target) => computeOutput({ ...fields, defaultOutput: fields.plot.y, target }),
  verify: (fields) => [
    ...formulaModelIssues(fields),
    ...(fields.variables.some((variable) => variable.name === fields.plot.x)
      ? []
      : [issue("inconsistentFields", "fields.plot.x", "The x axis must be a slider")]),
    ...(fields.outputs.some((output) => output.id === fields.plot.y)
      ? []
      : [issue("inconsistentFields", "fields.plot.y", "The y axis must be an output")]),
  ],
});

const labeledDiagramFields = z
  .object({
    diagramId: slugSchema,
    distractors: z.array(labelSchema).max(MAX_DISTRACTORS),
    mixUps: z
      .array(
        z.object({ feedback: explanationSchema, labels: z.array(labelSchema).length(2) }).strict(),
      )
      .max(MAX_MIX_UPS),
    parts: z
      .array(z.object({ label: labelSchema, partId: slugSchema }).strict())
      .min(2)
      .max(MAX_PARTS),
  })
  .strict();

type LabeledDiagramFields = z.output<typeof labeledDiagramFields>;

/** Parts must exist in the checked drawing, which is the only thing the player can draw. */
function diagramAssetIssues(fields: LabeledDiagramFields) {
  const knownParts = getDiagramParts(fields.diagramId);

  if (!knownParts) {
    return [issue("unknownAsset", "fields.diagramId", `No checked diagram "${fields.diagramId}"`)];
  }

  return fields.parts
    .filter((part) => !knownParts.includes(part.partId))
    .map((part) =>
      issue(
        "unknownAsset",
        "fields.parts",
        `"${fields.diagramId}" has no part "${part.partId}". Its parts: ${knownParts.join(", ")}`,
      ),
    );
}

function labeledDiagramIssues(fields: LabeledDiagramFields) {
  const labels = fields.parts.map((part) => part.label);
  const names = new Set([...labels, ...fields.distractors]);

  return [
    ...duplicateIssues(
      fields.parts.map((part) => part.partId),
      "fields.parts",
      "Part",
    ),
    ...duplicateIssues([...labels, ...fields.distractors], "fields.parts", "Label"),
    ...fields.mixUps
      .filter((mixUp) => mixUp.labels.some((label) => !names.has(label)))
      .map(() =>
        issue("inconsistentFields", "fields.mixUps", "A mix-up names a label that isn't offered"),
      ),
  ];
}

export const labeledDiagramTemplate = defineActivityTemplate({
  checks: ["interaction"],
  description: `Drag names onto the parts of a drawing from a checked library of diagrams, like the chambers of the heart. Only these diagrams and part ids exist; pick another template when none shows the idea. Fills: which diagram to use, the parts to label (each label in the lesson's language), distractor names and feedback for each likely mix-up.\nDiagrams (id (what it shows): part ids):\n${describeDiagrams()}`,
  expected: (fields) => ({
    kind: "assignment",
    pairs: Object.fromEntries(fields.parts.map((part) => [part.partId, part.label])),
  }),
  fields: labeledDiagramFields,
  id: "labeledDiagram",
  needsData: false,
  verify: (fields) => [...labeledDiagramIssues(fields), ...diagramAssetIssues(fields)],
});

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
