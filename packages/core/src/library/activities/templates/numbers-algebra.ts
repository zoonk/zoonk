import { z } from "zod";
import {
  choiceOptionSchema,
  choiceOptionsSchema,
  explanationSchema,
  idSchema,
  labelSchema,
  optionTextSchema,
  promptSchema,
  uniqueIdsSchema,
} from "../../steps/contract/content-schemas";
import { expressionSchema, unitSchema, variableSchema } from "../activity-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import {
  evaluateOrNull,
  guessScaleIssues,
  isClose,
  issue,
  resolveSliderValues,
  toRange,
  variableIssues,
} from "./_utils/template-helpers";

const MAX_MOVES = 5;
const MAX_TICKS = 40;
const MAX_PARTS = 4;
const MAX_SOLVER_STEPS = 5;
const MAX_WORKINGS = 5;

export const sliderGraphTemplate = defineActivityTemplate({
  checks: ["choice", "numeric"],
  description:
    "Move one input on a slider and watch a formula's output redraw on a graph. Fills: the formula, the slider range and unit, axis labels, a value to compare against, the source and the check question.",
  fields: z
    .object({
      compareAt: z.number().optional(),
      formula: expressionSchema,
      output: z.object({ label: labelSchema, unit: unitSchema.optional() }).strict(),
      variable: variableSchema,
    })
    .strict(),
  formulas: (fields) => [
    { expression: fields.formula, path: "fields.formula", ranges: [toRange(fields.variable)] },
  ],
  id: "sliderGraph",
  needsData: true,
  value: (fields, target) => {
    const values = resolveSliderValues([fields.variable], target);
    return values ? evaluateOrNull(fields.formula, values) : null;
  },
  verify: (fields) => [
    ...variableIssues(fields.variable, "fields.variable"),
    ...(fields.compareAt !== undefined &&
    (fields.compareAt < fields.variable.min || fields.compareAt > fields.variable.max)
      ? [
          issue(
            "inconsistentFields",
            "fields.compareAt",
            "The comparison is outside the slider range",
          ),
        ]
      : []),
  ],
});

const numberLineFields = z
  .object({
    label: labelSchema,
    max: z.number(),
    min: z.number(),
    moves: z
      .array(z.object({ by: z.number(), label: labelSchema.optional() }).strict())
      .min(1)
      .max(MAX_MOVES),
    start: z.number(),
    step: z.number().positive(),
    unit: unitSchema.optional(),
  })
  .strict();

/** Where the dot sits after each jump, starting point first. */
function numberLinePositions(fields: z.output<typeof numberLineFields>): number[] {
  const landings = fields.moves.map(
    (_, index) =>
      fields.start + fields.moves.slice(0, index + 1).reduce((sum, move) => sum + move.by, 0),
  );

  return [fields.start, ...landings];
}

export const numberLineTemplate = defineActivityTemplate({
  checks: ["numeric"],
  description:
    "Drag a dot along a number line; each move is drawn as a jump, so operations across zero make sense before the rule does. Fills: the range and step, the start value, the moves to make, where it should land, the check and the why.",
  fields: numberLineFields,
  id: "numberLine",
  needsData: false,
  value: (fields) => numberLinePositions(fields).at(-1) ?? null,
  verify: (fields) =>
    [
      fields.max <= fields.min &&
        issue("missingInteraction", "fields", "The number line has no range"),
      (fields.max - fields.min) / fields.step > MAX_TICKS &&
        issue("inconsistentFields", "fields.step", "The number line has too many ticks to read"),
      numberLinePositions(fields).some(
        (position) => position < fields.min || position > fields.max,
      ) && issue("inconsistentFields", "fields.moves", "A jump lands outside the number line"),
      fields.moves.some((move) => move.by === 0) &&
        issue("missingInteraction", "fields.moves", "A move of zero has nothing to show"),
    ].filter((item) => item !== false),
});

const sideSchema = z
  .object({
    label: labelSchema.optional(),
    parts: z.array(z.number().positive()).min(1).max(MAX_PARTS),
    total: z.number().positive(),
  })
  .strict();

const areaModelFields = z.discriminatedUnion("model", [
  z
    .object({
      height: sideSchema,
      model: z.literal("area"),
      unit: unitSchema.optional(),
      width: sideSchema,
    })
    .strict(),
  z.object({ bar: sideSchema, model: z.literal("bar"), unit: unitSchema.optional() }).strict(),
]);

function areaModelSides(fields: z.output<typeof areaModelFields>) {
  return fields.model === "area" ? [fields.width, fields.height] : [fields.bar];
}

export const areaModelTemplate = defineActivityTemplate({
  checks: ["choice", "numeric"],
  description:
    "Split a rectangle (area model) or a bar (bar model) into easy parts to see why a product or a share works. The answer is the area (width total × height total) or the bar total. Fills: the model, sizes, where to split, units, the check question and the why.",
  fields: areaModelFields,
  id: "areaModel",
  needsData: false,
  value: (fields) =>
    fields.model === "area" ? fields.width.total * fields.height.total : fields.bar.total,
  verify: (fields) => [
    ...areaModelSides(fields).flatMap((side, index) =>
      isClose(
        side.parts.reduce((sum, part) => sum + part, 0),
        side.total,
      )
        ? []
        : [
            issue(
              "inconsistentFields",
              `fields.sides.${index}`,
              "The parts don't add up to the total",
            ),
          ],
    ),
    ...(areaModelSides(fields).some((side) => side.parts.length > 1)
      ? []
      : [
          issue("missingInteraction", "fields", "Nothing is split, so there is nothing to explore"),
        ]),
  ],
});

const solverStepSchema = z
  .object({
    choices: choiceOptionsSchema(choiceOptionSchema),
    expression: expressionSchema,
    id: idSchema,
    math: optionTextSchema,
    prompt: promptSchema,
    unit: unitSchema.optional(),
    value: z.number(),
  })
  .strict();

export const stepSolverTemplate = defineActivityTemplate({
  checks: ["interaction", "numeric"],
  description:
    "Solve a problem one step at a time: the learner picks each next move and sees it as a picture and as math. Each step's value is computed from its expression. A numeric check reads the last step, or the step named in `output`. Fills: the problem, each step's math and expression, the choice at each step and the why for each answer.",
  expected: (fields) => ({
    kind: "assignment",
    pairs: Object.fromEntries(
      fields.steps.map((step) => [
        step.id,
        step.choices.find((choice) => choice.isCorrect)?.id ?? "",
      ]),
    ),
  }),
  fields: z
    .object({
      problem: promptSchema,
      steps: uniqueIdsSchema(solverStepSchema, { max: MAX_SOLVER_STEPS, min: 2 }),
    })
    .strict(),
  formulas: (fields) =>
    fields.steps.map((step, index) => ({
      expression: step.expression,
      path: `fields.steps.${index}.expression`,
      ranges: [],
    })),
  id: "stepSolver",
  needsData: false,
  value: (fields, target) => {
    const step = target.output
      ? fields.steps.find((item) => item.id === target.output)
      : fields.steps.at(-1);

    return step ? evaluateOrNull(step.expression) : null;
  },
  verify: (fields) =>
    fields.steps.flatMap((step, index) => {
      const computed = evaluateOrNull(step.expression);

      return computed === null || isClose(step.value, computed)
        ? []
        : [
            issue(
              "answerMismatch",
              `fields.steps.${index}.value`,
              `Step value ${String(step.value)} doesn't match the computed ${String(computed)}`,
            ),
          ];
    }),
});

const estimateRevealFields = z
  .object({
    comparison: explanationSchema,
    expression: expressionSchema,
    max: z.number(),
    min: z.number(),
    scale: z.enum(["linear", "log"]),
    takeaway: explanationSchema,
    unit: unitSchema,
    workings: z
      .array(z.object({ expression: expressionSchema, label: labelSchema }).strict())
      .min(1)
      .max(MAX_WORKINGS),
  })
  .strict();

export const estimateRevealTemplate = defineActivityTemplate({
  checks: ["numeric"],
  description:
    "Guess on a scale first, then see the real value next to the guess. The true value is computed from `expression`, and the workings show how. Fills: the question, the answer expression and its workings, the scale (linear or log) and range, a concrete comparison and the takeaway.",
  fields: estimateRevealFields,
  formulas: (fields) => [
    { expression: fields.expression, path: "fields.expression", ranges: [] },
    ...fields.workings.map((working, index) => ({
      expression: working.expression,
      path: `fields.workings.${index}.expression`,
      ranges: [],
    })),
  ],
  id: "estimateReveal",
  needsData: false,
  value: (fields) => evaluateOrNull(fields.expression),
  verify: (fields) => {
    const value = evaluateOrNull(fields.expression);
    const lastWorking = evaluateOrNull(fields.workings.at(-1)?.expression ?? "");

    return [
      ...guessScaleIssues({ ...fields, trueValue: value, trueValuePath: "fields.expression" }),
      ...(value !== null && lastWorking !== null && !isClose(lastWorking, value)
        ? [issue("answerMismatch", "fields.workings", "The last working doesn't reach the answer")]
        : []),
    ];
  },
});
