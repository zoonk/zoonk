import { z } from "zod";
import { explanationSchema, labelSchema } from "../../steps/contract/content-schemas";
import { expressionSchema, unitSchema } from "../activity-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import { evaluateOrNull, guessScaleIssues, isClose, issue } from "./_utils/template-helpers";

const MAX_WORKINGS = 5;

/**
 * Where the real value comes from: worked out by code from an expression (each working shown), or
 * cited data, whose source the activity's `data` names.
 */
const truthSchema = z.discriminatedUnion("kind", [
  z
    .object({
      expression: expressionSchema,
      kind: z.literal("computed"),
      workings: z
        .array(z.object({ expression: expressionSchema, label: labelSchema }).strict())
        .min(1)
        .max(MAX_WORKINGS),
    })
    .strict(),
  z.object({ kind: z.literal("cited"), value: z.number() }).strict(),
]);

const guessRevealFields = z
  .object({
    /** A concrete comparison that makes the real value feel its size. */
    comparison: explanationSchema.optional(),
    max: z.number(),
    min: z.number(),
    scale: z.enum(["linear", "log"]),
    /** Why the real value is what it is, shown once the guess is in. */
    takeaway: explanationSchema,
    truth: truthSchema,
    unit: unitSchema,
  })
  .strict();

type GuessRevealFields = z.output<typeof guessRevealFields>;

function trueValue(fields: GuessRevealFields): number | null {
  return fields.truth.kind === "cited"
    ? fields.truth.value
    : evaluateOrNull(fields.truth.expression);
}

function workingIssues(fields: GuessRevealFields, value: number | null) {
  if (fields.truth.kind !== "computed") {
    return [];
  }

  const lastWorking = evaluateOrNull(fields.truth.workings.at(-1)?.expression ?? "");

  return value !== null && lastWorking !== null && !isClose(lastWorking, value)
    ? [
        issue(
          "answerMismatch",
          "fields.truth.workings",
          "The last working doesn't reach the answer",
        ),
      ]
    : [];
}

export const guessRevealTemplate = defineActivityTemplate({
  checks: ["numeric"],
  description:
    'Guess on a scale first (linear or log), then see the real value next to the guess, so the gap is memorable, like how many seconds are in a year or how much the usual world map shrinks Africa. The real value is computed by code (`truth.kind` "computed": an expression and the workings that reach it) or cited data (`truth.kind` "cited": the value, with its source in `data`). Fills: the question, the scale and its range, the real value, an optional concrete comparison and the takeaway.',
  fields: guessRevealFields,
  formulas: (fields) =>
    fields.truth.kind === "computed"
      ? [
          { expression: fields.truth.expression, path: "fields.truth.expression", ranges: [] },
          ...fields.truth.workings.map((working, index) => ({
            expression: working.expression,
            path: `fields.truth.workings.${index}.expression`,
            ranges: [],
          })),
        ]
      : [],
  id: "guessReveal",
  needsData: (fields) => fields.truth.kind === "cited",
  value: (fields) => trueValue(fields),
  verify: (fields) => {
    const value = trueValue(fields);

    return [
      ...guessScaleIssues({ ...fields, trueValue: value, trueValuePath: "fields.truth" }),
      ...workingIssues(fields, value),
    ];
  },
});
