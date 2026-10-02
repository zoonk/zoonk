import { z } from "zod";
import {
  choiceOptionSchema,
  choiceOptionsSchema,
  explanationSchema,
  idSchema,
  languageCodeSchema,
  optionTextSchema,
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
    })
    .strict(),
  z
    .object({
      image: stepImageRequestSchema.optional(),
      text: richTextSchema,
      variant: z.literal("text"),
    })
    .strict(),
]);

/**
 * One idea in small steps. `exampleLineSlot` marks where the personal layer may add one sentence
 * tying the idea to this learner's life; `idea` says what that sentence should connect to.
 */
export const explanationContentSchema = z
  .object({
    exampleLineSlot: z.object({ idea: explanationSchema }).strict().optional(),
    image: stepImageRequestSchema.optional(),
    text: richTextSchema,
    title: promptSchema.optional(),
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
  })
  .strict();

/** Multiple choice with exactly one right option and a reason for every option. */
export const checkContentSchema = z
  .object({
    context: richTextSchema.optional(),
    image: stepImageRequestSchema.optional(),
    options: choiceOptionsSchema(choiceOptionSchema),
    question: promptSchema,
  })
  .strict();

/**
 * A written answer. Short answers listed in `acceptedAnswers` are matched by code; anything else
 * is graded later against the key points, one idea each.
 */
export const typedAnswerContentSchema = z
  .object({
    acceptedAnswers: z.array(optionTextSchema).max(MAX_KEY_POINTS).optional(),
    context: richTextSchema.optional(),
    keyPoints: z.array(explanationSchema).min(1).max(MAX_KEY_POINTS),
    question: promptSchema,
    sampleAnswer: richTextSchema,
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
