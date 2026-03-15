import { type BeltLevelResult } from "@zoonk/utils/belt-level";
import { z } from "zod";

const MAX_DAY_OF_WEEK = 6;
const MAX_HOUR_OF_DAY = 23;

const fillBlankAnswerSchema = z.object({
  kind: z.literal("fillBlank"),
  userAnswers: z.array(z.string()),
});

const listeningAnswerSchema = z.object({
  arrangedWords: z.array(z.string()),
  kind: z.literal("listening"),
});

const matchColumnsAnswerSchema = z.object({
  kind: z.literal("matchColumns"),
  mistakes: z.number(),
  userPairs: z.array(z.object({ left: z.string(), right: z.string() })),
});

const multipleChoiceAnswerSchema = z.object({
  kind: z.literal("multipleChoice"),
  selectedIndex: z.number(),
  selectedText: z.string(),
});

const readingAnswerSchema = z.object({
  arrangedWords: z.array(z.string()),
  kind: z.literal("reading"),
});

const selectImageAnswerSchema = z.object({
  kind: z.literal("selectImage"),
  selectedIndex: z.number(),
});

const sortOrderAnswerSchema = z.object({
  kind: z.literal("sortOrder"),
  userOrder: z.array(z.string()),
});

const translationAnswerSchema = z.object({
  kind: z.literal("translation"),
  questionText: z.string(),
  selectedText: z.string(),
  selectedWordId: z.string(),
});

const selectedAnswerSchema = z.discriminatedUnion("kind", [
  fillBlankAnswerSchema,
  listeningAnswerSchema,
  matchColumnsAnswerSchema,
  multipleChoiceAnswerSchema,
  readingAnswerSchema,
  selectImageAnswerSchema,
  sortOrderAnswerSchema,
  translationAnswerSchema,
]);

const stepTimingSchema = z.object({
  answeredAt: z.number(),
  dayOfWeek: z.number().int().min(0).max(MAX_DAY_OF_WEEK),
  durationSeconds: z.number(),
  hourOfDay: z.number().int().min(0).max(MAX_HOUR_OF_DAY),
});

export const completionInputSchema = z.object({
  activityId: z.string(),
  answers: z.record(z.string(), selectedAnswerSchema),
  dimensions: z.record(z.string(), z.number()),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startedAt: z.number(),
  stepTimings: z.record(z.string(), stepTimingSchema),
});

export type CompletionInput = z.infer<typeof completionInputSchema>;

export type CompletionResult =
  | {
      status: "success";
      belt: BeltLevelResult;
      brainPower: number;
      energyDelta: number;
      newTotalBp: number;
    }
  | { status: "error" }
  | { status: "unauthenticated" };
