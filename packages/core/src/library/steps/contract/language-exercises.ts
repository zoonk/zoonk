import { z } from "zod";

/**
 * A language exercise may show one picture: the prompt it was drawn from and, once drawn, its URL.
 * Teaching screens ask for images differently (`stepImageRequestSchema`) and link the file through
 * `Step.mediaAssetId`.
 */
const exerciseImageSchema = z.object({ prompt: z.string(), url: z.string().optional() }).strict();

const multipleChoiceOptionSchema = z
  .object({ feedback: z.string(), id: z.string(), isCorrect: z.boolean(), text: z.string() })
  .strict();

export const multipleChoiceContentSchema = z
  .object({
    context: z.string().optional(),
    image: exerciseImageSchema.optional(),
    options: z.array(multipleChoiceOptionSchema).min(1),
    question: z.string().optional(),
  })
  .strict();

const fillBlankChoiceSchema = z.string();

export const fillBlankContentSchema = z
  .object({
    answers: z.array(fillBlankChoiceSchema).min(1),
    distractors: z.array(fillBlankChoiceSchema),
    feedback: z.string(),
    question: z.string().optional(),
    romanizations: z.record(z.string(), z.string()).nullable().optional(),
    template: z.string(),
  })
  .strict();

const matchColumnsPairSchema = z.object({ left: z.string(), right: z.string() }).strict();

export const matchColumnsContentSchema = z
  .object({ pairs: z.array(matchColumnsPairSchema).min(1), question: z.string().optional() })
  .strict();

const alphabetFormSchema = z.object({ label: z.string(), symbol: z.string() }).strict();

export const alphabetContentSchema = z
  .object({
    audioText: z.string(),
    audioUrl: z.string().nullable(),
    forms: z.array(alphabetFormSchema),
    pronunciation: z.string(),
    readingAid: z.string(),
    symbol: z.string(),
  })
  .strict();

export type ExerciseImage = z.infer<typeof exerciseImageSchema>;
export type MultipleChoiceStepContent = z.infer<typeof multipleChoiceContentSchema>;
export type FillBlankStepContent = z.infer<typeof fillBlankContentSchema>;
export type MatchColumnsStepContent = z.infer<typeof matchColumnsContentSchema>;
