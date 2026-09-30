"use server";

import { checkLessonStep } from "@zoonk/core/lesson-player/check";
import { completeLibraryLesson } from "@zoonk/core/lesson-player/complete";
import {
  answerExplanationInputSchema,
  lessonStepCheckInputSchema,
  libraryLessonCompletionInputSchema,
} from "@zoonk/core/lesson-player/contract";
import { explainAnswer } from "@zoonk/core/library/items/explain-answer";
import {
  type AnswerExplanationOutcome,
  type LessonCheckOutcome,
  type LessonCompletionOutcome,
} from "@zoonk/player/lesson/types";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { z } from "zod";

const idSchema = z.uuid();

/**
 * The web player's step check: the same core capability as `POST /v1/steps/{stepId}/checks`.
 * Anything but a verdict or a finished run is a failure the player retries.
 */
export async function checkLessonStepAction({
  stepId,
  ...rawInput
}: {
  answer: unknown;
  durationMs: number;
  runId: string;
  stepId: string;
  timeZone: string;
  usedHelp: boolean;
}): Promise<LessonCheckOutcome> {
  const input = lessonStepCheckInputSchema.safeParse(rawInput);

  if (!input.success || !idSchema.safeParse(stepId).success) {
    return { status: "failed" };
  }

  const { data: outcome, error } = await safeAsync(() =>
    checkLessonStep({ input: input.data, stepId }),
  );

  if (error) {
    logError("[checkLessonStepAction] Failed to check an answer:", error);
    return { status: "failed" };
  }

  if (outcome.status === "checked") {
    return { result: outcome.result, status: "checked" };
  }

  return outcome.status === "runEnded" ? { status: "runEnded" } : { status: "failed" };
}

/** The web player's completion: the same core capability as `POST /v1/library/lessons/{id}/completions`. */
export async function completeLibraryLessonAction({
  lessonId,
  ...rawInput
}: {
  lessonId: string;
  runId: string;
  timeZone: string;
}): Promise<LessonCompletionOutcome> {
  const input = libraryLessonCompletionInputSchema.safeParse(rawInput);

  if (!input.success) {
    return { status: "failed" };
  }

  const { data: outcome, error } = await safeAsync(() =>
    completeLibraryLesson({ input: input.data, lessonId }),
  );

  if (error) {
    logError("[completeLibraryLessonAction] Failed to complete a lesson:", error);
    return { status: "failed" };
  }

  return outcome.status === "completed"
    ? { completion: outcome.completion, status: "completed" }
    : { status: "failed" };
}

/** "Explain answer": the same core capability as `POST /v1/steps/{stepId}/answer-explanations`. */
export async function explainAnswerAction({
  answer,
  stepId,
}: {
  answer: string;
  stepId: string;
}): Promise<AnswerExplanationOutcome> {
  const input = answerExplanationInputSchema.safeParse({ answer });

  if (!input.success || !idSchema.safeParse(stepId).success) {
    return { status: "failed" };
  }

  const { data: result, error } = await safeAsync(() =>
    explainAnswer({ answer: input.data.answer, target: { stepId } }),
  );

  if (error) {
    logError("[explainAnswerAction] Failed to explain an answer:", error);
    return { status: "failed" };
  }

  if (result.status === "explained") {
    return {
      explanation: result.explanation,
      explanationId: result.explanationId,
      status: "explained",
    };
  }

  if (result.status === "limitReached") {
    return { status: "limitReached", tier: result.limit.tier };
  }

  return result.status === "slowDown" ? result : { status: "failed" };
}
