import { lessonVisualSchema } from "@zoonk/ai/tasks/v2/visuals/schema";
import { z } from "zod";
import { exploreActivitySchema } from "../../activities/activity-templates";
import {
  choiceOptionSchema,
  choiceOptionsSchema,
  explanationSchema,
  idSchema,
  languageCodeSchema,
  optionTextSchema,
  pictureRequestSchema,
  promptSchema,
  richTextSchema,
  stepImageRequestSchema,
} from "./content-schemas";

const MAX_WORKED_STEPS = 8;
const MAX_KEY_POINTS = 5;
const MAX_SUMMARY_IDEAS = 5;
const MAX_MATH_LENGTH = 300;

/** Display math in LaTeX, like `3x + 2 = 11`. Only shown, never evaluated. */
const mathSchema = z.string().min(1).max(MAX_MATH_LENGTH);

/** A chart or a timeline the player draws from data, on a screen that is about one. */
const visualSchema = lessonVisualSchema.optional();

/**
 * The first screen opens with the idea: a guess that doesn't count, or a surprising fact or real
 * situation. A guess reveals the answer whatever the learner picks.
 */
export const hookContentSchema = z.discriminatedUnion("variant", [
  z
    .object({
      image: stepImageRequestSchema.optional(),
      options: choiceOptionsSchema(
        z.object({ id: idSchema, isCorrect: z.boolean(), text: optionTextSchema }).strict(),
      ),
      question: promptSchema,
      reveal: explanationSchema,
      variant: z.literal("guess"),
      visual: visualSchema,
    })
    .strict(),
  z
    .object({
      image: stepImageRequestSchema.optional(),
      text: richTextSchema,
      variant: z.literal("text"),
      visual: visualSchema,
    })
    .strict(),
]);

/**
 * One idea in small steps. `exampleLineSlot` marks where the personal layer may add one sentence
 * tying the idea to this learner's life; `idea` says what that sentence should connect to.
 * `explore` is an activity template the screen shows to explore (a model to move, a process, a
 * map), with no question and no check.
 */
export const explanationContentSchema = z
  .object({
    exampleLineSlot: z.object({ idea: explanationSchema }).strict().optional(),
    explore: exploreActivitySchema.optional(),
    image: stepImageRequestSchema.optional(),
    text: richTextSchema,
    title: promptSchema.optional(),
    visual: visualSchema,
  })
  .strict();

/** A solved problem shown one step at a time: the player reveals each step on tap. */
export const workedExampleContentSchema = z
  .object({
    image: stepImageRequestSchema.optional(),
    problem: richTextSchema,
    result: explanationSchema,
    steps: z
      .array(z.object({ math: mathSchema.optional(), text: explanationSchema }).strict())
      .min(2)
      .max(MAX_WORKED_STEPS),
    title: promptSchema.optional(),
    visual: visualSchema,
  })
  .strict();

/**
 * The sentence of an earlier reading screen (a hook's text, an explanation or a worked example)
 * that decides a question's right answer, and that screen's `position` in the lesson: after a
 * wrong answer, "From the lesson" marks it when it shows that screen. Code stores one only after
 * finding the quote on that screen (`findQuestionBases`).
 */
const questionBasisSchema = z
  .object({ position: z.number().int().min(0), quote: explanationSchema })
  .strict();

const MAX_PICTURE_OPTIONS = 4;

/**
 * An option of a question whose options are pictures: `picture` asks for the thing alone, `alt`
 * says what it looks like without naming it, and `text` names it once the answer is checked.
 */
const checkOptionSchema = choiceOptionSchema
  .extend({ picture: pictureRequestSchema.optional() })
  .strict();

type CheckOption = z.infer<typeof checkOptionSchema>;

/** Picture options come all together, two to four of them, on a question with no other picture. */
function pictureOptionsIssue(content: {
  image?: unknown;
  options: readonly CheckOption[];
  visual?: unknown;
}): string | null {
  const pictured = content.options.filter((option) => option.picture).length;

  if (pictured === 0) {
    return null;
  }

  if (pictured !== content.options.length) {
    return "Give every option a picture, or none";
  }

  if (pictured > MAX_PICTURE_OPTIONS) {
    return `A question shows at most ${String(MAX_PICTURE_OPTIONS)} pictures`;
  }

  if (content.options.some((option) => namesItself(option))) {
    return "A picture's description says what it looks like without naming the option";
  }

  return content.image || content.visual
    ? "A question whose options are pictures has no other picture or visual"
    : null;
}

/** Whether an option's picture description names the option, which would give the answer away. */
function namesItself(option: CheckOption): boolean {
  const name = option.text.trim().toLocaleLowerCase();
  return name.length > 2 && (option.picture?.alt.toLocaleLowerCase().includes(name) ?? false);
}

/**
 * On a picture whose numbers mark parts, an option that is a number names one of them: the
 * answer key comes from the parts, so a number past the last one marks nothing.
 */
function numberedOptionsIssue(content: {
  image?: { parts?: readonly string[] };
  options: readonly CheckOption[];
}): string | null {
  const count = content.image?.parts?.length;

  if (!count) {
    return null;
  }

  const marksNothing = content.options.some((option) => {
    const number = Number(option.text);
    return Number.isInteger(number) && (number < 1 || number > count);
  });

  return marksNothing
    ? `The picture numbers ${String(count)} parts, so a number option is one of 1 to ${String(count)}`
    : null;
}

/**
 * Multiple choice with exactly one right option and a reason for every option. Options can be
 * pictures, for telling separate things apart by how they look (which doorway is Gothic?), and
 * numbers, for where a part sits on a picture whose numbers mark its parts (which number is the
 * ovary?).
 */
export const checkContentSchema = z
  .object({
    basis: questionBasisSchema.nullable(),
    context: richTextSchema.optional(),
    image: stepImageRequestSchema.optional(),
    options: choiceOptionsSchema(checkOptionSchema),
    question: promptSchema,
    visual: visualSchema,
  })
  .strict()
  .superRefine((content, context) => {
    for (const issue of [pictureOptionsIssue(content), numberedOptionsIssue(content)]) {
      if (issue) {
        context.addIssue({ code: "custom", message: issue, path: ["options"] });
      }
    }
  });

/**
 * A written answer. Short answers listed in `acceptedAnswers` are matched by code; anything else
 * is graded later against the key points, one idea each.
 */
export const typedAnswerContentSchema = z
  .object({
    acceptedAnswers: z.array(optionTextSchema).max(MAX_KEY_POINTS).optional(),
    basis: questionBasisSchema.nullable(),
    context: richTextSchema.optional(),
    keyPoints: z.array(explanationSchema).min(1).max(MAX_KEY_POINTS),
    question: promptSchema,
    sampleAnswer: richTextSchema,
    visual: visualSchema,
  })
  .strict();

/** Say the target text out loud in `language`. */
export const spokenAnswerContentSchema = z
  .object({
    language: languageCodeSchema,
    prompt: promptSchema,
    romanization: optionTextSchema.optional(),
    targetText: optionTextSchema,
    translation: optionTextSchema.optional(),
  })
  .strict();

/** The summary card: each idea of the lesson in one sentence. */
export const summaryContentSchema = z
  .object({
    ideas: z
      .array(z.object({ text: explanationSchema }).strict())
      .min(1)
      .max(MAX_SUMMARY_IDEAS),
  })
  .strict();
