import { completionInputSchema } from "@zoonk/core/player/contracts/completion-input-schema";
import { stepContentEnvelopeSchema } from "@zoonk/core/steps/contract/content";
import { z } from "zod";
import { generationStatusSchema, lessonKindSchema } from "./curriculum";

const wordBankOptionSchema = z.object({
  audioUrl: z.string().nullable(),
  pronunciation: z.string().nullable(),
  romanization: z.string().nullable(),
  translation: z.string().nullable(),
  word: z.string(),
});

const serializedWordSchema = z.object({
  audioUrl: z.string().nullable(),
  distractors: z.array(z.string()),
  id: z.string(),
  pronunciation: z.string().nullable(),
  romanization: z.string().nullable(),
  translation: z.string(),
  word: z.string(),
});

const serializedSentenceSchema = z.object({
  audioUrl: z.string().nullable(),
  distractors: z.array(z.string()),
  explanation: z.string().nullable(),
  id: z.string(),
  romanization: z.string().nullable(),
  sentence: z.string(),
  translation: z.string(),
  translationDistractors: z.array(z.string()),
});

const translationOptionSchema = z.object({
  audioUrl: z.string().nullable(),
  id: z.string(),
  pronunciation: z.string().nullable(),
  romanization: z.string().nullable(),
  word: z.string(),
});

const serializedStepResourceSchema = z.object({
  fillBlankOptions: z.array(wordBankOptionSchema),
  id: z.uuid(),
  matchColumnsRightItems: z.array(z.string()),
  position: z.number().int().min(0),
  sentence: serializedSentenceSchema.nullable(),
  sentenceWordOptions: z.array(wordBankOptionSchema),
  sortOrderItems: z.array(z.string()),
  translationOptions: z.array(translationOptionSchema),
  vocabularyOptions: z.array(serializedWordSchema),
  word: serializedWordSchema.nullable(),
  wordBankOptions: z.array(wordBankOptionSchema),
});

const serializedStepSchema = z.intersection(
  serializedStepResourceSchema,
  stepContentEnvelopeSchema,
);

const serializedLessonSchema = z.object({
  description: z.string().nullable(),
  id: z.uuid(),
  kind: lessonKindSchema,
  language: z.string(),
  lessonSentences: z.array(serializedSentenceSchema),
  lessonWords: z.array(serializedWordSchema),
  organizationId: z.uuid().nullable(),
  steps: z.array(serializedStepSchema),
  title: z.string().nullable(),
});

const lessonGenerationTargetSchema = z
  .object({ kind: z.enum(["lesson", "sourceLesson"]), lessonId: z.uuid() })
  .meta({ id: "LessonGenerationTarget" });

export const lessonContentResponseSchema = z
  .discriminatedUnion("status", [
    z.object({ lesson: serializedLessonSchema, status: z.literal("ready") }),
    z.object({
      generationTarget: lessonGenerationTargetSchema.nullable(),
      status: z.literal("notGenerated"),
    }),
    z.object({ generationLessonId: z.uuid().nullable(), status: z.literal("reviewEmpty") }),
  ])
  .meta({ id: "LessonContentResponse" });

const nextLessonSchema = z.object({
  chapterId: z.uuid(),
  chapterPosition: z.number().int().min(0),
  chapterSlug: z.string(),
  chapterTitle: z.string(),
  lessonDescription: z.string().nullable(),
  lessonGenerationStatus: generationStatusSchema,
  lessonId: z.uuid(),
  lessonKind: lessonKindSchema,
  lessonPosition: z.number().int().min(0),
  lessonSlug: z.string(),
  lessonTitle: z.string().nullable(),
});

export const lessonSuccessorResponseSchema = z
  .object({ lesson: nextLessonSchema.nullable() })
  .meta({ id: "LessonSuccessorResponse" });

export const lessonCompletionRequestSchema = completionInputSchema
  .omit({ lessonId: true })
  .meta({ id: "LessonCompletionRequest" });

const beltLevelSchema = z.object({
  belt: z.string(),
  bpPerLevel: z.number(),
  bpToNextLevel: z.number(),
  isMaxLevel: z.boolean(),
  level: z.number().int(),
  progressInLevel: z.number(),
});

export const lessonCompletionResponseSchema = z
  .object({
    belt: beltLevelSchema,
    brainPower: z.number(),
    correctCount: z.number().int().min(0),
    energyDelta: z.number(),
    incorrectCount: z.number().int().min(0),
    newTotalBp: z.number(),
  })
  .meta({ id: "LessonCompletionResponse" });

const preloadGenerationSchema = z.discriminatedUnion("kind", [
  z.object({ chapterId: z.uuid(), generationId: z.string(), kind: z.literal("chapter") }),
  z.object({ generationId: z.string(), kind: z.literal("lesson"), lessonId: z.uuid() }),
]);

export const lessonPreloadResponseSchema = z
  .object({ generations: z.array(preloadGenerationSchema) })
  .meta({ id: "LessonPreloadResponse" });
