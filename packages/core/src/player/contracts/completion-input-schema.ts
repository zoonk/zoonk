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
  selectedOptionId: z.string(),
});

const readingAnswerSchema = z.object({
  arrangedWords: z.array(z.string()),
  kind: z.literal("reading"),
});

const selectImageAnswerSchema = z.object({
  kind: z.literal("selectImage"),
  selectedOptionId: z.string(),
});

const sortOrderAnswerSchema = z.object({
  kind: z.literal("sortOrder"),
  userOrder: z.array(z.string()),
});

const storyAnswerSchema = z.object({
  kind: z.literal("story"),
  selectedOptionId: z.string(),
});

const translationAnswerSchema = z.object({
  kind: z.literal("translation"),
  selectedOptionId: z.string(),
});

const investigationProblemAnswerSchema = z.object({
  kind: z.literal("investigation"),
  variant: z.literal("problem"),
});

const investigationActionAnswerSchema = z.object({
  kind: z.literal("investigation"),
  selectedOptionId: z.string(),
  variant: z.literal("action"),
});

const investigationCallAnswerSchema = z.object({
  kind: z.literal("investigation"),
  selectedOptionId: z.string(),
  variant: z.literal("call"),
});

/**
 * Investigation has 3 answer variants sharing `kind: "investigation"`.
 * Since zod's discriminatedUnion requires unique discriminator values,
 * we use z.union for the full answer schema instead.
 */
export const selectedAnswerSchema = z.union([
  fillBlankAnswerSchema,
  investigationProblemAnswerSchema,
  investigationActionAnswerSchema,
  investigationCallAnswerSchema,
  listeningAnswerSchema,
  matchColumnsAnswerSchema,
  multipleChoiceAnswerSchema,
  readingAnswerSchema,
  selectImageAnswerSchema,
  sortOrderAnswerSchema,
  storyAnswerSchema,
  translationAnswerSchema,
]);

const stepTimingSchema = z.object({
  answeredAt: z.number(),
  dayOfWeek: z.number().int().min(0).max(MAX_DAY_OF_WEEK),
  durationSeconds: z.number(),
  hourOfDay: z.number().int().min(0).max(MAX_HOUR_OF_DAY),
});

/**
 * Investigation loop state sent from the client so the server can
 * compute the same investigation-specific score. Intermediate
 * experiment answers overwrite the same physical step ID in the
 * answers map, so the loop state is the only way to reconstruct
 * the full scoring input server-side.
 */
const investigationLoopSchema = z.object({
  actionTimings: z.array(stepTimingSchema).default([]),
  usedOptionIds: z.array(z.string()),
});

export const completionInputSchema = z.object({
  activityId: z.string(),
  answers: z.record(z.string(), selectedAnswerSchema),
  investigationLoop: investigationLoopSchema.optional(),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startedAt: z.number(),
  stepTimings: z.record(z.string(), stepTimingSchema),
});

export type SelectedAnswer = z.infer<typeof selectedAnswerSchema>;
export type InvestigationLoopState = z.infer<typeof investigationLoopSchema>;
export type CompletionInput = z.infer<typeof completionInputSchema>;

export type CompletionResult = {
  belt: BeltLevelResult;
  brainPower: number;
  correctCount: number;
  energyDelta: number;
  incorrectCount: number;
  newTotalBp: number;
};
