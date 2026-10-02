import { z } from "zod";
import { GENERATED_ITEM_SCHEMAS } from "../items/item-schemas";
import { type LessonScreenKind } from "../lesson-spec/lesson-spec-rules";

const MIN_OPTIONS = 2;
const MAX_GUESS_OPTIONS = 4;
const MAX_CHECK_OPTIONS = 5;
const MIN_WORKED_STEPS = 2;
const MAX_WORKED_STEPS = 8;
const MAX_KEY_POINTS = 5;
const MAX_ACCEPTED_ANSWERS = 5;
const MAX_SUMMARY_IDEAS = 5;
/** Mirrors the step contract's image request limits (core `stepImageRequestSchema`). */
const MAX_IMAGE_PROMPT_LENGTH = 400;
const MAX_IMAGE_ALT_LENGTH = 160;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the kind comes first, then the setup, then the answers. */

/** A picture that teaches, only where the spec asked for one. Code links the generated file. */
const imageRequest = z
  .object({
    prompt: z.string().max(MAX_IMAGE_PROMPT_LENGTH),
    alt: z.string().max(MAX_IMAGE_ALT_LENGTH),
  })
  .nullable();

const hookGuessScreen = z.object({
  kind: z.literal("hookGuess"),
  question: z.string(),
  options: z
    .array(z.object({ text: z.string(), isCorrect: z.boolean() }))
    .min(MIN_OPTIONS)
    .max(MAX_GUESS_OPTIONS),
  reveal: z.string(),
  image: imageRequest,
});

const hookTextScreen = z.object({
  kind: z.literal("hookText"),
  text: z.string(),
  image: imageRequest,
});

const explanationScreen = z.object({
  kind: z.literal("explanation"),
  title: z.string(),
  text: z.string(),
  /** What a one-sentence example from the learner's own life should connect to, or null. */
  exampleLineIdea: z.string().nullable(),
  image: imageRequest,
});

const workedExampleScreen = z.object({
  kind: z.literal("workedExample"),
  title: z.string(),
  problem: z.string(),
  steps: z
    .array(z.object({ text: z.string(), math: z.string().nullable() }))
    .min(MIN_WORKED_STEPS)
    .max(MAX_WORKED_STEPS),
  result: z.string(),
  image: imageRequest,
});

const checkScreen = z.object({
  kind: z.literal("check"),
  context: z.string().nullable(),
  question: z.string(),
  options: z
    .array(z.object({ text: z.string(), isCorrect: z.boolean(), reason: z.string() }))
    .min(MIN_OPTIONS)
    .max(MAX_CHECK_OPTIONS),
  image: imageRequest,
});

/**
 * A calculation as data, the same shape as a numeric item: code recomputes the
 * answer, turns each common mistake into a wrong option and stores the problem
 * as an item, so reviews can use new numbers.
 */
const mathCheckScreen = z.object({
  kind: z.literal("mathCheck"),
  context: z.string().nullable(),
  question: z.string(),
  math: GENERATED_ITEM_SCHEMAS.numeric.shape.math,
  /** Why the right answer is right, with `{name}` placeholders instead of computed numbers. */
  correctReason: z.string(),
});

const typedAnswerScreen = z.object({
  kind: z.literal("typedAnswer"),
  context: z.string().nullable(),
  question: z.string(),
  keyPoints: z.array(z.string()).min(1).max(MAX_KEY_POINTS),
  sampleAnswer: z.string(),
  acceptedAnswers: z.array(z.string()).max(MAX_ACCEPTED_ANSWERS),
});

/**
 * An activity from the catalog. `content` is the activity as JSON text
 * (`{ prompt, fields, check, data }`), since each template has its own fields
 * and code validates them against the template's schema.
 */
const activityScreen = z.object({
  kind: z.literal("activity"),
  template: z.string(),
  content: z.string(),
});

/* oxlint-enable eslint/sort-keys */

/** One schema per written kind, so variants can ask for exactly the kind they rewrite. */
export const WRITTEN_SCREEN_SCHEMAS = {
  activity: activityScreen,
  check: checkScreen,
  explanation: explanationScreen,
  hookGuess: hookGuessScreen,
  hookText: hookTextScreen,
  mathCheck: mathCheckScreen,
  typedAnswer: typedAnswerScreen,
  workedExample: workedExampleScreen,
} as const;

export const writtenScreenSchema = z.union([
  hookGuessScreen,
  hookTextScreen,
  explanationScreen,
  workedExampleScreen,
  checkScreen,
  mathCheckScreen,
  typedAnswerScreen,
  activityScreen,
]);

/** A lesson as the writer returns it: one screen per planned screen, then the summary card. */
export const writtenLessonSchema = z.object({
  screens: z.array(writtenScreenSchema),
  summary: z.array(z.string()).min(1).max(MAX_SUMMARY_IDEAS),
});

export type WrittenScreen = z.infer<typeof writtenScreenSchema>;
export type WrittenScreenKind = WrittenScreen["kind"];
export type WrittenLesson = z.infer<typeof writtenLessonSchema>;

/**
 * What each planned screen may be written as. A check or the application can
 * be multiple choice, a calculation as data or a typed answer ("Explain it in
 * your words"); activities only go where the spec put them.
 */
export const WRITTEN_KINDS_BY_SCREEN: Readonly<
  Record<LessonScreenKind, readonly WrittenScreenKind[]>
> = {
  activity: ["activity"],
  application: ["check", "mathCheck", "typedAnswer"],
  check: ["check", "mathCheck", "typedAnswer"],
  explanation: ["explanation"],
  hook: ["hookGuess", "hookText"],
  workedExample: ["workedExample"],
};
