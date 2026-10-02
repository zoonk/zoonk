import { z } from "zod";

/** Item formats, matching the `ItemFormat` database enum. */
const ITEM_FORMATS = [
  "multipleChoice",
  "trueFalse",
  "typed",
  "spoken",
  "essay",
  "matchPairs",
  "order",
  "numeric",
] as const;

export type ItemFormat = (typeof ITEM_FORMATS)[number];

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;
const MIN_KEY_POINTS = 1;
const MAX_KEY_POINTS = 5;
const MAX_PAIRS = 6;
const MAX_ORDER_STEPS = 7;
/** An AP scoring guideline's row is worth up to 6 points (a long essay's evidence row is 3 or 4). */
const MAX_RUBRIC_ROW_POINTS = 6;

/**
 * One row of an essay's rubric. `points` is the row's worth when the exam's scoring guidelines give
 * each row its own whole points (AP free-response: thesis 1, evidence and commentary 4), and null
 * when the exam's rubric doesn't.
 */
export const essayRubricRowSchema = z.object({
  criterion: z.string(),
  description: z.string(),
  points: z.number().int().min(1).max(MAX_RUBRIC_ROW_POINTS).nullable(),
});

const difficulty = z.enum(["easy", "medium", "hard"]);

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the situation and question come before the answers. */
const multipleChoiceItem = z.object({
  format: z.literal("multipleChoice"),
  difficulty,
  context: z.string().nullable(),
  question: z.string(),
  options: z
    .array(
      z.object({
        text: z.string(),
        isCorrect: z.boolean(),
        reason: z.string(),
        misconception: z.string().nullable(),
      }),
    )
    .min(MIN_OPTIONS)
    .max(MAX_OPTIONS),
});

const trueFalseItem = z.object({
  format: z.literal("trueFalse"),
  difficulty,
  context: z.string().nullable(),
  statement: z.string(),
  isTrue: z.boolean(),
  reason: z.string(),
  misconception: z.string().nullable(),
});

const openAnswerFields = {
  difficulty,
  context: z.string().nullable(),
  question: z.string(),
  keyPoints: z.array(z.string()).min(MIN_KEY_POINTS).max(MAX_KEY_POINTS),
  acceptedAnswers: z.array(z.string()),
  sampleAnswer: z.string(),
};

const typedItem = z.object({ format: z.literal("typed"), ...openAnswerFields });
const spokenItem = z.object({ format: z.literal("spoken"), ...openAnswerFields });

const essayItem = z.object({
  format: z.literal("essay"),
  difficulty,
  context: z.string().nullable(),
  question: z.string(),
  rubric: z.array(essayRubricRowSchema).min(2),
  keyPoints: z.array(z.string()).min(MIN_KEY_POINTS).max(MAX_KEY_POINTS),
  sampleOutline: z.string(),
});

const matchPairsItem = z.object({
  format: z.literal("matchPairs"),
  difficulty,
  question: z.string(),
  pairs: z
    .array(z.object({ left: z.string(), right: z.string() }))
    .min(2)
    .max(MAX_PAIRS),
  reason: z.string(),
});

const orderItem = z.object({
  format: z.literal("order"),
  difficulty,
  question: z.string(),
  steps: z.array(z.string()).min(2).max(MAX_ORDER_STEPS),
  reason: z.string(),
});

/**
 * A math problem as data: the question names its variables in braces, code
 * recomputes the solution from the expression, and new values within each
 * range give fresh practice without new writing.
 */
const mathProblem = z.object({
  variables: z.array(
    z.object({
      name: z.string(),
      value: z.number(),
      min: z.number(),
      max: z.number(),
      step: z.number(),
      unit: z.string().nullable(),
    }),
  ),
  solution: z.string(),
  answer: z.number(),
  unit: z.string().nullable(),
  /** Same shape as activity checks, so numeric answers are graded one way everywhere. */
  tolerance: z.object({ kind: z.enum(["absolute", "relative"]), value: z.number() }),
  steps: z.array(z.object({ text: z.string(), expression: z.string().nullable() })),
  commonMistakes: z
    .array(z.object({ expression: z.string(), misconception: z.string(), reason: z.string() }))
    .min(1),
});

const numericItem = z.object({
  format: z.literal("numeric"),
  difficulty,
  context: z.string().nullable(),
  question: z.string(),
  math: mathProblem,
});
/* oxlint-enable eslint/sort-keys */

/** One output schema per format keeps each call's structured output small and exact. */
export const GENERATED_ITEM_SCHEMAS = {
  essay: essayItem,
  matchPairs: matchPairsItem,
  multipleChoice: multipleChoiceItem,
  numeric: numericItem,
  order: orderItem,
  spoken: spokenItem,
  trueFalse: trueFalseItem,
  typed: typedItem,
} as const satisfies Record<ItemFormat, z.ZodType>;

export type GeneratedItem = z.infer<(typeof GENERATED_ITEM_SCHEMAS)[ItemFormat]>;
export type GeneratedMathProblem = z.infer<typeof mathProblem>;
