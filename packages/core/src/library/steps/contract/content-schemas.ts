import { aimForCharacters } from "@zoonk/utils/character-target";
import { LANGUAGE_CODE_PATTERN } from "@zoonk/utils/languages";
import { z } from "zod";

const STEP_TEXT_TARGETS = {
  explanation: 400,
  label: 40,
  option: 160,
  part: 80,
  prompt: 240,
  richText: 1200,
} as const;

/** A technical key, not text: an answer sends it back, so a longer one could never be submitted. */
export const MAX_STEP_ID_LENGTH = 40;

export const idSchema = z.string().min(1).max(MAX_STEP_ID_LENGTH);
export const labelSchema = aimForCharacters(z.string().min(1), STEP_TEXT_TARGETS.label);
export const optionTextSchema = aimForCharacters(z.string().min(1), STEP_TEXT_TARGETS.option);
export const promptSchema = aimForCharacters(z.string().min(1), STEP_TEXT_TARGETS.prompt);

export const explanationSchema = aimForCharacters(z.string().min(1), STEP_TEXT_TARGETS.explanation);

/** Use English for image generation; this description is never shown to learners. */
export const partSchema = aimForCharacters(z.string().min(1), STEP_TEXT_TARGETS.part);

export const richTextSchema = aimForCharacters(z.string().min(1), STEP_TEXT_TARGETS.richText);

export const languageCodeSchema = z.string().regex(LANGUAGE_CODE_PATTERN);

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
