import { type BeltLevelResult } from "@zoonk/utils/belt-level";
import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { z } from "zod";
import { createSelectedAnswerSchema } from "./_utils/selected-answer-schema";

const MAX_DAY_OF_WEEK = 6;
const MAX_HOUR_OF_DAY = 23;

/** @public Player transports reuse this exact runtime schema for submitted answer shapes. */
export const selectedAnswerSchema = createSelectedAnswerSchema();

const stepTimingSchema = z.object({
  answeredAt: z.number(),
  dayOfWeek: z.number().int().min(0).max(MAX_DAY_OF_WEEK),
  durationSeconds: z.number(),
  hourOfDay: z.number().int().min(0).max(MAX_HOUR_OF_DAY),
});

export const completionInputSchema = z.object({
  answers: z.record(z.string(), selectedAnswerSchema),
  lessonId: z.string(),
  startedAt: z.number(),
  stepTimings: z.record(z.string(), stepTimingSchema),
  timeZone: z.string().refine(isValidTimeZone),
});

export type SelectedAnswer = z.infer<typeof selectedAnswerSchema>;
export type CompletionInput = z.infer<typeof completionInputSchema>;

export type CompletionResult = {
  belt: BeltLevelResult;
  brainPower: number;
  correctCount: number;
  energyDelta: number;
  incorrectCount: number;
  newTotalBp: number;
};
