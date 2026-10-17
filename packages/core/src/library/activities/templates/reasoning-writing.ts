import { z } from "zod";
import {
  explanationSchema,
  idSchema,
  labelSchema,
  optionTextSchema,
  promptSchema,
  uniqueIdsSchema,
} from "../../steps/contract/content-schemas";
import { expressionSchema } from "../activity-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import { duplicateIssues, evaluateOrNull, isClose, issue } from "./_utils/template-helpers";

const MAX_GROUPS = 4;
const MAX_ITEMS = 10;
const MAX_PAIRS = 6;
const MAX_DISTRACTORS = 3;
const MAX_CANDIDATES = 4;
const MAX_STEPS = 6;

const categorizeFields = z
  .object({
    groups: uniqueIdsSchema(
      z.object({ id: idSchema, label: labelSchema, rule: explanationSchema }).strict(),
      { max: MAX_GROUPS, min: 2 },
    ),
    items: uniqueIdsSchema(
      z
        .object({ groupId: idSchema, id: idSchema, text: optionTextSchema, why: explanationSchema })
        .strict(),
      { max: MAX_ITEMS, min: 3 },
    ),
  })
  .strict();

export const categorizeTemplate = defineActivityTemplate({
  checks: ["interaction"],
  description:
    "Sort examples into groups to learn the rule that separates them, like chemical versus physical change. Fills: group names and rules, items with their right group and why each belongs.",
  expected: (fields) => ({
    kind: "assignment",
    pairs: Object.fromEntries(fields.items.map((item) => [item.id, item.groupId])),
  }),
  fields: categorizeFields,
  id: "categorize",
  needsData: false,
  verify: (fields) => {
    const groupIds = new Set(fields.groups.map((group) => group.id));
    const used = new Set(fields.items.map((item) => item.groupId));

    return [
      fields.items.some((item) => !groupIds.has(item.groupId)) &&
        issue("inconsistentFields", "fields.items", "An item points to a group that doesn't exist"),
      fields.groups.some((group) => !used.has(group.id)) &&
        issue("inconsistentFields", "fields.groups", "Every group needs at least one item"),
    ].filter((item) => item !== false);
  },
});

const matchPairsFields = z
  .object({
    distractors: z
      .array(
        z
          .object({
            side: z.enum(["left", "right"]),
            text: optionTextSchema,
            why: explanationSchema,
          })
          .strict(),
      )
      .max(MAX_DISTRACTORS),
    pairs: uniqueIdsSchema(
      z
        .object({
          id: idSchema,
          left: optionTextSchema,
          right: optionTextSchema,
          why: explanationSchema.optional(),
        })
        .strict(),
      { max: MAX_PAIRS, min: 2 },
    ),
  })
  .strict();

export const matchPairsTemplate = defineActivityTemplate({
  checks: ["interaction"],
  description:
    "Pair items that belong together, with look-alike traps, like false friends between languages. The learner matches each left item (by pair id) to a right item (by pair id). Fills: the pairs, look-alike distractors and a why for each likely mix-up.",
  expected: (fields) => ({
    kind: "assignment",
    pairs: Object.fromEntries(fields.pairs.map((pair) => [pair.id, pair.id])),
  }),
  fields: matchPairsFields,
  id: "matchPairs",
  needsData: false,
  verify: (fields) => [
    ...duplicateIssues(
      [
        ...fields.pairs.map((pair) => pair.left),
        ...fields.distractors.filter((item) => item.side === "left").map((item) => item.text),
      ],
      "fields.pairs",
      "Left item",
    ),
    ...duplicateIssues(
      [
        ...fields.pairs.map((pair) => pair.right),
        ...fields.distractors.filter((item) => item.side === "right").map((item) => item.text),
      ],
      "fields.pairs",
      "Right item",
    ),
  ],
});

const candidateShape = { id: idSchema, isStrong: z.boolean(), why: explanationSchema };

const argumentFields = z
  .object({
    claim: optionTextSchema,
    evidence: uniqueIdsSchema(
      z.object({ ...candidateShape, citation: labelSchema, quote: optionTextSchema }).strict(),
      { max: MAX_CANDIDATES, min: 2 },
    ),
    reasoning: uniqueIdsSchema(z.object({ ...candidateShape, text: optionTextSchema }).strict(), {
      max: MAX_CANDIDATES,
      min: 2,
    }),
  })
  .strict();

export const argumentBuilderTemplate = defineActivityTemplate({
  checks: ["interaction"],
  description:
    "Build an argument from a claim, evidence and reasoning, and see why a quote must support the claim. Exactly one evidence and one reasoning option are strong. Fills: the claim, candidate quotes with citations, reasoning options and why each is strong or weak.",
  expected: (fields) => ({
    ids: [...fields.evidence, ...fields.reasoning]
      .filter((item) => item.isStrong)
      .map((item) => item.id),
    kind: "selection",
  }),
  fields: argumentFields,
  id: "argumentBuilder",
  needsData: false,
  verify: (fields) =>
    [
      fields.evidence.filter((item) => item.isStrong).length !== 1 &&
        issue("inconsistentFields", "fields.evidence", "Exactly one quote must be strong"),
      fields.reasoning.filter((item) => item.isStrong).length !== 1 &&
        issue("inconsistentFields", "fields.reasoning", "Exactly one reasoning must be strong"),
    ].filter((item) => item !== false),
});

const findErrorFields = z
  .object({
    /**
     * "Spot the AI's mistake": the worked answer is an AI assistant's reply to `problem`, shown as
     * an AI answer to check. Left out, it's a plain worked answer.
     */
    author: z.literal("ai").optional(),
    correction: explanationSchema,
    errorStepId: idSchema,
    problem: promptSchema,
    steps: uniqueIdsSchema(
      z
        .object({
          expression: expressionSchema.optional(),
          id: idSchema,
          result: z.number().optional(),
          text: optionTextSchema,
        })
        .strict(),
      { max: MAX_STEPS, min: 3 },
    ),
    why: explanationSchema,
  })
  .strict();

type FindErrorFields = z.output<typeof findErrorFields>;

/** Steps with math are checked by code: a step is wrong when its stated result isn't what its expression gives. */
function wrongMathSteps(fields: FindErrorFields): string[] {
  return fields.steps.flatMap((step) => {
    if (step.expression === undefined || step.result === undefined) {
      return [];
    }

    const computed = evaluateOrNull(step.expression);
    return computed !== null && isClose(computed, step.result) ? [] : [step.id];
  });
}

function findErrorIssues(fields: FindErrorFields) {
  const withMath = fields.steps.filter(
    (step) => step.expression !== undefined || step.result !== undefined,
  );

  const wrong = wrongMathSteps(fields);

  return [
    !fields.steps.some((step) => step.id === fields.errorStepId) &&
      issue("inconsistentFields", "fields.errorStepId", "The wrong step isn't in the list"),
    // Writers put the mistake in the final "So…" almost every time, which teaches learners to
    // check only the last line: the conclusion should come out wrong because of an earlier step.
    fields.steps.at(-1)?.id === fields.errorStepId &&
      issue(
        "inconsistentFields",
        "fields.errorStepId",
        "The mistake is in the last step; make it in an earlier step the conclusion builds on",
      ),
    withMath.some((step) => step.expression === undefined || step.result === undefined) &&
      issue(
        "inconsistentFields",
        "fields.steps",
        "A math step needs both an expression and a result",
      ),
    withMath.length > 0 &&
      (wrong.length !== 1 || wrong[0] !== fields.errorStepId) &&
      issue("answerMismatch", "fields.errorStepId", "The math shows a different wrong step"),
  ].filter((item) => item !== false);
}

export const findErrorTemplate = defineActivityTemplate({
  checks: ["interaction"],
  description:
    'Spot the wrong step in a worked answer, like a price change that looks symmetric but isn\'t. Steps with math give an expression and the result they claim; code finds the one whose result is wrong. Set author to "ai" for "Spot the AI\'s mistake": the steps are an AI assistant\'s answer to the problem, with one plausible mistake to catch. The wrong step is never the last one: later steps build on it, so the conclusion comes out wrong because of it. Fills: the worked steps, which one is wrong, why and the corrected step.',
  expected: (fields) => ({ ids: [fields.errorStepId], kind: "selection" }),
  fields: findErrorFields,
  id: "findError",
  needsData: false,
  verify: (fields) => findErrorIssues(fields),
});
