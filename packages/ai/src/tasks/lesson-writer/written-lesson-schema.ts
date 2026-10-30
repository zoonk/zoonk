import { z } from "zod";
import { imageRequestSchema, numberedImageRequestSchema } from "../images/image-request-schema";
import { GENERATED_ITEM_SCHEMAS } from "../items/item-schemas";
import { type LessonScreenKind } from "../lesson-spec/lesson-spec-rules";
import { lessonVisualSchema } from "../visuals/visual-schema";

const MIN_OPTIONS = 2;
const MAX_GUESS_OPTIONS = 4;
const MAX_CHECK_OPTIONS = 5;
const MIN_WORKED_STEPS = 2;
const MAX_WORKED_STEPS = 8;
const MAX_KEY_POINTS = 5;
const MAX_ACCEPTED_ANSWERS = 5;
const MAX_SUMMARY_IDEAS = 5;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the kind comes first, then the setup, then the answers. */

const visual = lessonVisualSchema.nullable();

const hookGuessScreen = z.object({
  kind: z.literal("hookGuess"),
  question: z.string(),
  options: z
    .array(z.object({ text: z.string(), isCorrect: z.boolean() }))
    .min(MIN_OPTIONS)
    .max(MAX_GUESS_OPTIONS),
  reveal: z.string(),
  image: imageRequestSchema,
  visual,
});

const hookTextScreen = z.object({
  kind: z.literal("hookText"),
  text: z.string(),
  image: imageRequestSchema,
  visual,
});

const explanationScreen = z.object({
  kind: z.literal("explanation"),
  title: z.string(),
  text: z.string(),
  /** What a one-sentence example from the learner's own life should connect to. */
  exampleLineIdea: z.string().nullable(),
  image: imageRequestSchema,
  visual,
  /** `content` is `{ fields, data }` as JSON text, which code validates like an activity's. */
  explore: z.object({ template: z.string(), content: z.string() }).nullable(),
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
  image: imageRequestSchema,
  visual,
});

const checkScreen = z.object({
  kind: z.literal("check"),
  context: z.string().nullable(),
  question: z.string(),
  options: z
    .array(
      z.object({
        text: z.string(),
        isCorrect: z.boolean(),
        reason: z.string(),
        picture: imageRequestSchema,
      }),
    )
    .min(MIN_OPTIONS)
    .max(MAX_CHECK_OPTIONS),
  image: numberedImageRequestSchema,
  visual,
});

/**
 * Code recomputes the answer, turns each common mistake into a wrong option and stores the problem
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
  visual,
});

/** `content` is JSON text, since each template has its own fields that code validates. */
const activityScreen = z.object({
  kind: z.literal("activity"),
  template: z.string(),
  content: z.string(),
});

/**
 * The earlier screen's sentence that decides the right answer, copied exactly so the app can mark
 * it beside a wrong answer. Code drops a quote that isn't on that screen.
 */
const basis = z.object({ screen: z.number().int(), quote: z.string() }).nullable();

const checkScreenWithBasis = checkScreen.extend({ basis });
const mathCheckScreenWithBasis = mathCheckScreen.extend({ basis });
const typedAnswerScreenWithBasis = typedAnswerScreen.extend({ basis });

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
  checkScreenWithBasis,
  mathCheckScreenWithBasis,
  typedAnswerScreenWithBasis,
  activityScreen,
]);

export const writtenLessonSchema = z.object({
  screens: z.array(writtenScreenSchema),
  summary: z.array(z.string()).min(1).max(MAX_SUMMARY_IDEAS),
});

export type WrittenScreen = z.infer<typeof writtenScreenSchema>;
export type WrittenScreenKind = WrittenScreen["kind"];
export type WrittenLesson = z.infer<typeof writtenLessonSchema>;

const WRITTEN_KINDS_BY_SCREEN: Readonly<Record<LessonScreenKind, readonly WrittenScreenKind[]>> = {
  activity: ["activity"],
  application: ["check", "mathCheck"],
  check: ["check", "mathCheck"],
  explanation: ["explanation"],
  hook: ["hookGuess", "hookText"],
  workedExample: ["workedExample"],
};

/**
 * Learners would rather pick than type an answer, so a check or the application is typed only for
 * exams that ask short written answers (`shortAnswers`).
 */
export function getWrittenKinds({
  kind,
  shortAnswers,
}: {
  kind: LessonScreenKind;
  shortAnswers: boolean;
}): readonly WrittenScreenKind[] {
  const kinds = WRITTEN_KINDS_BY_SCREEN[kind];

  return shortAnswers && (kind === "check" || kind === "application")
    ? [...kinds, "typedAnswer"]
    : kinds;
}
