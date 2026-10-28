import { z } from "zod";

const STEP_TEXT_LIMITS = {
  explanation: 400,
  id: 40,
  label: 40,
  option: 160,
  part: 80,
  prompt: 240,
  richText: 1200,
} as const;

export const idSchema = z.string().min(1).max(STEP_TEXT_LIMITS.id);
export const labelSchema = z.string().min(1).max(STEP_TEXT_LIMITS.label);
export const optionTextSchema = z.string().min(1).max(STEP_TEXT_LIMITS.option);
export const promptSchema = z.string().min(1).max(STEP_TEXT_LIMITS.prompt);
export const explanationSchema = z.string().min(1).max(STEP_TEXT_LIMITS.explanation);

/** Use English for image generation; this description is never shown to learners. */
export const partSchema = z.string().min(1).max(STEP_TEXT_LIMITS.part);

export const richTextSchema = z.string().min(1).max(STEP_TEXT_LIMITS.richText);

export const languageCodeSchema = z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/u);

export const citationSchema = z
  .object({
    publisher: labelSchema.optional(),
    title: optionTextSchema,
    url: z.url().optional(),
    year: z.number().int().optional(),
  })
  .strict();

/** Link generated files through `Step.mediaAssetId`; do not store their URLs in step JSON. */
export const pictureRequestSchema = z
  .object({ alt: optionTextSchema, prompt: explanationSchema })
  .strict();

const MAX_NUMBERED_PARTS = 6;

export const stepImageRequestSchema = pictureRequestSchema
  .extend({ parts: z.array(partSchema).min(2).max(MAX_NUMBERED_PARTS).optional() })
  .strict();

function hasUniqueIds(items: readonly { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function hasOneCorrectOption(options: readonly { isCorrect: boolean }[]): boolean {
  return options.filter((option) => option.isCorrect).length === 1;
}

export const choiceOptionSchema = z
  .object({
    id: idSchema,
    isCorrect: z.boolean(),
    reason: explanationSchema,
    text: optionTextSchema,
  })
  .strict();

const MIN_CHOICE_OPTIONS = 2;
const MAX_CHOICE_OPTIONS = 5;

export function choiceOptionsSchema<TOption extends z.ZodType<{ id: string; isCorrect: boolean }>>(
  option: TOption,
) {
  return z
    .array(option)
    .min(MIN_CHOICE_OPTIONS)
    .max(MAX_CHOICE_OPTIONS)
    .refine(hasUniqueIds, { message: "Option ids must be unique" })
    .refine(hasOneCorrectOption, { message: "Exactly one option must be correct" });
}

export function uniqueIdsSchema<TItem extends z.ZodType<{ id: string }>>(
  item: TItem,
  bounds: { max: number; min: number },
) {
  return z
    .array(item)
    .min(bounds.min)
    .max(bounds.max)
    .refine(hasUniqueIds, { message: "Ids must be unique" });
}
