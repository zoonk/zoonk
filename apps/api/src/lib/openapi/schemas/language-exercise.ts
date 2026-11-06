import { exerciseContentWith } from "@zoonk/core/player/contracts/exercise-content";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

const wordBankOptionSchema = z.object({
  audioUrl: z.string().nullable(),
  romanization: z.string().nullable(),
  translation: z.string().nullable(),
  word: z.string(),
});

const readingPromptWordSchema = z.object({
  translation: z
    .string()
    .nullable()
    .meta({ description: "The sentence's words it translates, or null when no sure match exists" }),
  word: z
    .string()
    .meta({ description: "A word of the prompt, or a phrase the lesson translates as a unit" }),
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

const serializedStepResourceShape = {
  fillBlankOptions: z.array(wordBankOptionSchema),
  id: uuidSchema(),
  matchColumnsRightItems: z.array(z.string()),
  position: z.number().int().min(0),
  readingPromptWords: z.array(readingPromptWordSchema),
  sentence: serializedSentenceSchema.nullable(),
  sentenceWordOptions: z.array(wordBankOptionSchema),
  translationOptions: z.array(translationOptionSchema),
  vocabularyOptions: z.array(serializedWordSchema),
  word: serializedWordSchema.nullable(),
  wordBankOptions: z.array(wordBankOptionSchema),
};

export const serializedStepSchema = exerciseContentWith(serializedStepResourceShape);
