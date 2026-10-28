import { z } from "zod";
import { idSchema, labelSchema, uniqueIdsSchema } from "../../steps/contract/content-schemas";
import { identifierSchema, outputSchema, variableSchema } from "../activity-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import { parseExpression } from "../expression/parse-expression";
import { computeOutput, formulaModelIssues, outputFormulas } from "./_utils/formula-model";
import { duplicateIssues, issue } from "./_utils/template-helpers";

const MAX_VARIABLES = 4;
const MAX_OUTPUTS = 4;
const MAX_EVENTS = 4;

const eventSchema = z.object({ label: labelSchema, name: identifierSchema }).strict();

const formulaModelFields = z
  .object({
    compareAt: z.number().optional(),
    events: z.array(eventSchema).max(MAX_EVENTS).optional(),
    outputs: uniqueIdsSchema(outputSchema, { max: MAX_OUTPUTS, min: 1 }),
    plot: z.object({ x: identifierSchema, y: idSchema }).strict().optional(),
    title: labelSchema.optional(),
    variables: z.array(variableSchema).min(1).max(MAX_VARIABLES),
  })
  .strict();

type FormulaModelFields = z.output<typeof formulaModelFields>;

function eventsOff(fields: Pick<FormulaModelFields, "events">): Record<string, number> {
  return Object.fromEntries((fields.events ?? []).map((event) => [event.name, 0]));
}

function defaultOutputId(fields: FormulaModelFields): string | undefined {
  return fields.plot?.y ?? fields.outputs[0]?.id;
}

function eventIssues(fields: FormulaModelFields) {
  const events = fields.events ?? [];

  const used = new Set(
    fields.outputs.flatMap((output) => {
      const parsed = parseExpression(output.formula);
      return parsed.ok ? parsed.expression.variables : [];
    }),
  );

  return [
    ...duplicateIssues(
      [...fields.variables.map((variable) => variable.name), ...events.map((event) => event.name)],
      "fields.events",
      "Name",
    ),
    ...events
      .filter((event) => !used.has(event.name))
      .map((event) =>
        issue("missingInteraction", "fields.events", `Event "${event.name}" changes nothing`),
      ),
  ];
}

function plotIssues(fields: FormulaModelFields) {
  const { compareAt, plot } = fields;
  const x = fields.variables.find((variable) => variable.name === (plot?.x ?? ""));
  const axis = plot ? x : fields.variables[0];

  return [
    plot !== undefined &&
      !x &&
      issue("inconsistentFields", "fields.plot.x", "The x axis must be a slider"),
    plot !== undefined &&
      !fields.outputs.some((output) => output.id === plot.y) &&
      issue("inconsistentFields", "fields.plot.y", "The y axis must be an output"),
    compareAt !== undefined &&
      axis !== undefined &&
      (compareAt < axis.min || compareAt > axis.max) &&
      issue("inconsistentFields", "fields.compareAt", "The comparison is outside the slider range"),
  ].filter((item) => item !== false);
}

export const formulaModelTemplate = defineActivityTemplate({
  checks: ["choice", "numeric"],
  description:
    "A model of formulas to play with: sliders drive outputs computed from formulas, with one output drawn across one slider's range, like money growing at a rate, where a thrown ball lands, an extra mortgage payment or a coffee cart's profit. Optional what-if `events` are 0/1 names the formulas use, off at the start; a check turns one on with an input of 1. `plot` names the slider on the x axis and the output on the y axis (default: the first of each), and `compareAt` marks one x value to compare with. A numeric check reads `output` (default: the plotted output) with the sliders at `inputs`. Fills: the formulas, the sliders with ranges and units, the outputs, any what-ifs, a short `title` for a named model (\"Projectile\") and the check question.",
  fields: formulaModelFields,
  formulas: (fields) =>
    outputFormulas({
      ...fields,
      extraRanges: (fields.events ?? []).map((event) => ({
        max: 1,
        min: 0,
        name: event.name,
        step: 1,
      })),
    }),
  id: "formulaModel",
  needsData: true,
  value: (fields, target) =>
    computeOutput({
      ...fields,
      defaultOutput: defaultOutputId(fields),
      fixed: eventsOff(fields),
      target,
    }),
  verify: (fields) => [
    ...formulaModelIssues(fields),
    ...eventIssues(fields),
    ...plotIssues(fields),
  ],
});
