import { exerciseContentSchema } from "@zoonk/core/player/contracts/exercise-content";
import { z } from "zod";

const wordBankOptionSchema = z.object({
  audioUrl: z.string().nullable(),
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
  translationOptions: z.array(translationOptionSchema),
  vocabularyOptions: z.array(serializedWordSchema),
  word: serializedWordSchema.nullable(),
  wordBankOptions: z.array(wordBankOptionSchema),
});

/** A language exercise with the words and sentences its screen needs. */
export const serializedStepSchema = z.intersection(
  serializedStepResourceSchema,
  exerciseContentSchema,
);
