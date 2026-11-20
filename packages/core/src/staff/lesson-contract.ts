import { StepVariantKind } from "@zoonk/db/enums";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

const id = uuidSchema();
const text = z.string();

const screenVariantSchema = z.object({
  content: z.unknown().meta({ description: "Stored JSON for this variant" }),
  id,
  key: text,
  kind: z.enum(StepVariantKind),
});

export const staffLessonParamsSchema = z.strictObject({ lessonId: id });

const vocabulary = z.object({
  audioAvailable: z.boolean(),
  distractors: z.array(text),
  id,
  position: z.int(),
  romanization: text.nullable(),
  translation: text,
});

export const staffLessonSchema = z.object({
  id,
  ideas: z.array(z.object({ label: text.optional(), text })),
  language: text,
  plan: z.unknown().meta({ description: "The editable lesson plan, or null if none is saved" }),
  screens: z.array(
    z.object({
      citation: z.object({ page: z.int().nullable(), sourceId: id }).nullable(),
      content: z.unknown().meta({ description: "Stored JSON for this screen kind" }),
      id,
      ideaIndex: z.int().nullable(),
      kind: text,
      mediaAssetId: id.nullable(),
      position: z.int(),
      sentence: text.nullable(),
      sentenceId: id.nullable(),
      skillId: id.nullable(),
      variants: z.array(screenVariantSchema),
      word: text.nullable(),
      wordId: id.nullable(),
    }),
  ),
  sentences: z.array(
    vocabulary.extend({
      explanation: text,
      otherSentenceOrders: z.array(text),
      otherTranslationOrders: z.array(text),
      sentence: text,
      translationDistractors: z.array(text),
    }),
  ),
  targetLanguage: text.nullable(),
  title: text,
  version: z.int().nullable().meta({ description: "The current screen version, if published" }),
  words: z.array(vocabulary.extend({ note: text.nullable(), word: text })),
});
