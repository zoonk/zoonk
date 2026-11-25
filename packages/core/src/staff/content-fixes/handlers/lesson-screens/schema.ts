import { GENERATED_ITEM_SCHEMAS } from "@zoonk/ai/tasks/items/schemas";
import { StepKind, StepVariantKind } from "@zoonk/db";
import { z } from "zod";
import { screenQuestionSchema } from "../../../../library/lessons/_utils/screen-question-item";
import { stepImageRequestSchema } from "../../../../library/steps/contract/content-schemas";
import { idSchema } from "../fix-handler";
import { sourcePageSchema } from "../source-page";
import { romanizationSchema } from "../vocabulary-row";

const text = z.string().trim().min(1);
const texts = z.array(text);
const content = z.record(z.string(), z.json());

const wordFields = z.object({
  distractors: texts,
  note: text.nullable().optional(),
  translation: text,
});

const sentenceFields = z.object({
  distractors: texts,
  explanation: text,
  otherSentenceOrders: texts,
  otherTranslationOrders: texts,
  translation: text,
  translationDistractors: texts,
});

const vocabularyIdentity = {
  audioUrl: z.string().nullable(),
  id: idSchema,
  organizationId: idSchema,
  romanization: z.string().nullable(),
};

const word = z.object({
  ...vocabularyIdentity,
  distractors: z.array(z.string()),
  note: z.string().nullable(),
  translation: z.string(),
  word: z.string(),
});

const sentence = z.object({
  ...vocabularyIdentity,
  distractors: z.array(z.string()),
  explanation: z.string(),
  ordersOwedAt: z.string().nullable(),
  otherSentenceOrders: z.array(z.string()),
  otherTranslationOrders: z.array(z.string()),
  sentence: z.string(),
  translation: z.string(),
  translationDistractors: z.array(z.string()),
});

const idea = z.union([
  z.strictObject({ from: z.int().nonnegative() }),
  z.strictObject({ from: z.int().nonnegative().optional(), label: text, text }),
]);

const numeric = GENERATED_ITEM_SCHEMAS.numeric
  .pick({ context: true, math: true, question: true })
  .extend({ correctReason: text });

const common = {
  citation: z.strictObject({ page: sourcePageSchema, sourceId: idSchema }).nullable().optional(),
  content: content.optional(),
  idea: z.int().nonnegative().nullable().optional(),
  mediaAssetId: idSchema.nullable().optional(),
  picture: stepImageRequestSchema.optional(),
};

const kept = z.strictObject({
  ...common,
  id: idSchema,
  remark: z.literal(true).optional(),
  variants: z.array(z.strictObject({ content, id: idSchema })).optional(),
});

const added = z.strictObject({
  ...common,
  kind: z.enum(StepKind),
  numeric: numeric.optional(),
  sentence: text.optional(),
  skillId: idSchema.optional(),
  word: text.optional(),
});

export const setScreensSchema = z.strictObject({
  ideas: z.array(idea).min(1).optional(),
  screens: z.array(z.union([kept, added])).min(1),
  sentences: z
    .array(
      z.union([
        sentenceFields.partial().extend({ id: idSchema }).strict(),
        sentenceFields
          .extend({ key: text, romanization: romanizationSchema, sentence: text })
          .strict(),
      ]),
    )
    .optional(),
  version: z.int().positive(),
  words: z
    .array(
      z.union([
        wordFields.partial().extend({ id: idSchema }).strict(),
        wordFields.extend({ key: text, romanization: romanizationSchema, word: text }).strict(),
      ]),
    )
    .optional(),
});

const provenance = z
  .object({
    generatedAt: z.iso.datetime(),
    model: z.string(),
    promptVersion: z.string(),
    runId: z.string(),
  })
  .nullable();

const screen = z.object({
  content,
  contractVersion: z.int(),
  id: idSchema,
  itemId: idSchema.nullable(),
  kind: z.enum(StepKind),
  marks: z.json(),
  mediaAssetId: idSchema.nullable(),
  optionPictures: z.array(z.object({ mediaAssetId: idSchema, optionId: z.string() })),
  pictureAvailableAt: z.string().nullable(),
  pictureRemovedAt: z.string().nullable(),
  position: z.int(),
  provenance,
  sentenceId: idSchema.nullable(),
  skillId: idSchema.nullable(),
  sourceId: idSchema.nullable(),
  sourcePage: z.int().nullable(),
  sources: z.array(z.object({ contentHash: z.string().nullable(), sourceId: idSchema })),
  variants: z.array(
    z.object({
      content,
      contractVersion: z.int(),
      id: idSchema,
      key: z.string(),
      kind: z.enum(StepVariantKind),
      provenance,
    }),
  ),
  wordId: idSchema.nullable(),
});

export const snapshotSchema = z.object({
  screens: z.array(screen),
  sentences: z.array(sentence),
  summary: z.json(),
  version: z.int(),
  words: z.array(word),
});
const mediaLink = z.discriminatedUnion("target", [
  z.object({ key: text, position: z.int(), target: z.literal("picture") }),
  z.object({ key: text, position: z.int(), target: z.literal("alphabet") }),
  z.object({ key: text, position: z.int(), target: z.literal("idea") }),
  z.object({
    key: text,
    positions: z.array(z.int()),
    /** Screens asked to mark again, whose example box the new one replaces. */
    remarked: z.array(z.int()).optional(),
    target: z.literal("marks"),
  }),
  z.object({
    create: z.boolean(),
    id: idSchema,
    key: text,
    language: text,
    target: z.enum(["word", "sentence"]),
  }),
]);

export type ScreenMediaLink = z.infer<typeof mediaLink>;

export const storedScreensSchema = z.object({
  after: snapshotSchema,
  before: snapshotSchema,
  changedSentenceIds: z.array(idSchema),
  changedWordIds: z.array(idSchema),
  id: idSchema,
  mediaLinks: z.array(mediaLink).optional(),
  model: z.literal("Lesson"),
  newItems: z.array(z.object({ id: idSchema, question: screenQuestionSchema, skillId: idSchema })),
  op: z.literal("setScreens"),
  proposal: setScreensSchema.nullable(),
});
export type Screen = z.infer<typeof screen>;
export type ScreenSnapshot = z.infer<typeof snapshotSchema>;
export type ScreenList = z.infer<typeof setScreensSchema>;
export type StoredScreens = z.infer<typeof storedScreensSchema>;
