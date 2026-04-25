import { z } from "zod";
import { stepImageSchema } from "./image";

const coreOptionSchema = z
  .object({
    feedback: z.string(),
    id: z.string(),
    isCorrect: z.boolean(),
    text: z.string(),
  })
  .strict();

const coreMultipleChoiceContentSchema = z
  .object({
    context: z.string().optional(),
    image: stepImageSchema.optional(),
    kind: z.literal("core"),
    options: z.array(coreOptionSchema).min(1),
    question: z.string().optional(),
  })
  .strict();

export const multipleChoiceContentSchema = coreMultipleChoiceContentSchema;

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

const matchColumnsPairSchema = z
  .object({
    left: z.string(),
    right: z.string(),
  })
  .strict();

export const matchColumnsContentSchema = z
  .object({
    pairs: z.array(matchColumnsPairSchema).min(1),
    question: z.string(),
  })
  .strict();

export const sortOrderContentSchema = z
  .object({
    feedback: z.string(),
    items: z.array(z.string()).min(1),
    question: z.string(),
  })
  .strict();

const selectImageOptionSchema = z
  .object({
    feedback: z.string(),
    id: z.string(),
    isCorrect: z.boolean(),
    prompt: z.string(),
    url: z.string().optional(),
  })
  .strict();

export const selectImageContentSchema = z
  .object({
    options: z.array(selectImageOptionSchema).min(1),
    question: z.string(),
  })
  .strict();

export type MultipleChoiceStepContent = z.infer<typeof multipleChoiceContentSchema>;
export type FillBlankStepContent = z.infer<typeof fillBlankContentSchema>;
export type MatchColumnsStepContent = z.infer<typeof matchColumnsContentSchema>;
export type SortOrderStepContent = z.infer<typeof sortOrderContentSchema>;
export type SelectImageStepContent = z.infer<typeof selectImageContentSchema>;
