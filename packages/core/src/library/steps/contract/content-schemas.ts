import { z } from "zod";

/**
 * Length limits keep every screen readable on a phone. They live in the schemas, so the model sees
 * them in its output schema and the validators report the same numbers.
 */
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

/**
 * A part a picture's number marks, in English for the drawing and its check, never shown: its name,
 * and where it sits when that's easy to mistake ("right atrium, upper left as seen from the front").
 */
export const partSchema = z.string().min(1).max(STEP_TEXT_LIMITS.part);

/**
 * Rich text is Markdown limited to emphasis, lists, inline code and `$...$` LaTeX, the same subset
 * the player already renders.
 */
export const richTextSchema = z.string().min(1).max(STEP_TEXT_LIMITS.richText);

/** Language codes follow the app's locale codes, like "en", "pt" or "pt-BR". */
export const languageCodeSchema = z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/u);

export const citationSchema = z
  .object({
    publisher: labelSchema.optional(),
    title: optionTextSchema,
    url: z.url().optional(),
    year: z.number().int().optional(),
  })
  .strict();

/**
 * A step asks for at most one image; the generated file is linked through `Step.mediaAssetId`,
 * never stored as a URL in step JSON. `prompt` describes the scene and `alt` is the text
 * alternative screen readers announce.
 */
export const pictureRequestSchema = z
  .object({ alt: optionTextSchema, prompt: explanationSchema })
  .strict();

/** Numbers a picture can carry legibly, one per part. */
const MAX_NUMBERED_PARTS = 6;

/**
 * A screen's picture request. `parts` numbers the parts the screen asks about, in English and in
 * order (1 is the first): code draws each number on its part, so the answer key (which number
 * is which part) comes from this list, never from what the drawing decided.
 */
export const stepImageRequestSchema = pictureRequestSchema
  .extend({ parts: z.array(partSchema).min(2).max(MAX_NUMBERED_PARTS).optional() })
  .strict();

function hasUniqueIds(items: readonly { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function hasOneCorrectOption(options: readonly { isCorrect: boolean }[]): boolean {
  return options.filter((option) => option.isCorrect).length === 1;
}

/**
 * Multiple choice everywhere gives every option its own reason, so a wrong pick explains the
 * misconception behind it and the right pick says why it's right.
 */
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

/** A list of items the learner drags, orders or picks, each addressed by an id that must be unique. */
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
