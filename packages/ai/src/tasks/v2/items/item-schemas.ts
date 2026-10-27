import { z } from "zod";
import { imageRequestSchema } from "../images/image-request-schema";
import { lessonVisualSchema } from "../visuals/visual-schema";

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
/** USMLE and the PMP print up to 8 options; most exams print 4 or 5. */
const MAX_OPTIONS = 8;
/** JEE Advanced asks numbers to 2 decimal places; no exam asks more than 4. */
const MAX_DECIMAL_PLACES = 4;
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
const essayRubricRowSchema = z.object({
  criterion: z.string(),
  description: z.string(),
  points: z.number().int().min(1).max(MAX_RUBRIC_ROW_POINTS).nullable(),
});

const difficulty = z.enum(["easy", "medium", "hard"]);

/**
 * How many options a multiple-choice question asks the learner to pick: one, an exact number
 * ("choose two", with exactly that many right) or every right one ("select all that apply", one
 * or more right). The exam's format sets it for the call that writes the question.
 */
export const optionSelectSchema = z.union([
  z.number().int().min(1).max(MAX_OPTIONS),
  z.literal("all"),
]);

export type OptionSelect = z.infer<typeof optionSelectSchema>;

/**
 * How a typed number is entered, as the exam's answer grid or box takes it: any number, graded by
 * its tolerance (`number`); a whole number (`integer`, JEE Main's integer answers); a number given
 * to `places` decimal places (`decimals`, JEE Advanced's "correct to two decimal places"); or a
 * fraction or a decimal (`fraction`, the SAT's student-produced answers). The exam's format sets it
 * for the call that writes the question.
 */
export const numericEntrySchema = z.object({
  kind: z.enum(["number", "integer", "decimals", "fraction"]),
  places: z.number().int().min(1).max(MAX_DECIMAL_PLACES).nullable(),
});

export type NumericEntry = z.infer<typeof numericEntrySchema>;

/** A chart or timeline the app draws next to the question, when the question reads one; or null. */
const visual = lessonVisualSchema.nullable();

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the situation and question come before the answers. */
const multipleChoiceItem = z.object({
  format: z.literal("multipleChoice"),
  difficulty,
  context: z.string().nullable(),
  visual,
  /** The picture a question is about (a diagram, a map), drawn and checked before it is stored. */
  image: imageRequestSchema,
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
  /**
   * The options keep the order they're written in: a fixed set whose order means something (True,
   * False, Not given; "1 only, 2 only, both, neither"; a quantity comparison's four answers).
   * Every other question's options are shuffled once when stored.
   */
  fixedOrder: z.boolean(),
});

const trueFalseItem = z.object({
  format: z.literal("trueFalse"),
  difficulty,
  context: z.string().nullable(),
  visual,
  /** The picture a question is about (a diagram, a map), drawn and checked before it is stored. */
  image: imageRequestSchema,
  statement: z.string(),
  isTrue: z.boolean(),
  reason: z.string(),
  misconception: z.string().nullable(),
});

const openAnswerSetup = { difficulty, context: z.string().nullable() };

const openAnswerFields = {
  question: z.string(),
  keyPoints: z.array(z.string()).min(MIN_KEY_POINTS).max(MAX_KEY_POINTS),
  acceptedAnswers: z.array(z.string()),
  sampleAnswer: z.string(),
};

const typedItem = z.object({
  format: z.literal("typed"),
  ...openAnswerSetup,
  visual,
  /** The picture a question is about (a diagram, a map), drawn and checked before it is stored. */
  image: imageRequestSchema,
  ...openAnswerFields,
});

const spokenItem = z.object({
  format: z.literal("spoken"),
  ...openAnswerSetup,
  ...openAnswerFields,
});

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
  /**
   * Other answers that are right too, as expressions over the same variables, for a question with
   * more than one ("one possible value of x": the other root). Empty for most questions.
   */
  otherSolutions: z.array(z.string()),
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
