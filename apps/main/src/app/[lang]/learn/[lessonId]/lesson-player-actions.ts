"use server";

import { checkLessonStep } from "@zoonk/core/lesson-player/check";
import { completeLibraryLesson } from "@zoonk/core/lesson-player/complete";
import {
  type LessonPicture,
  answerExplanationInputSchema,
  lessonStepCheckInputSchema,
  libraryLessonCompletionInputSchema,
} from "@zoonk/core/lesson-player/contract";
import { getLessonPictures } from "@zoonk/core/lesson-player/pictures";
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
 * An error is a failure the player sends again; a finished run or an answer that doesn't fit the
 * screen is a refusal, which no retry changes.
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

  // An answer that doesn't fit the contract never will: sending it again would only loop.
  if (!input.success || !idSchema.safeParse(stepId).success) {
    return { status: "refused" };
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

  return { status: "refused" };
}

/**
 * The web player's completion: the same core capability as `POST /v1/library/lessons/{id}/completions`.
 * A run missing an answer is `incomplete`, so the player goes back to that screen.
 */
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

  if (outcome.status === "completed") {
    return { completion: outcome.completion, status: "completed" };
  }

  return outcome.status === "invalid" ? { status: "incomplete" } : { status: "failed" };
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
    return { explanation: result.explanation, status: "explained" };
  }

  if (result.status === "limitReached") {
    return { period: result.limit.period, status: "limitReached", tier: result.limit.tier };
  }

  return result.status === "slowDown" ? result : { status: "failed" };
}

/**
 * The lesson's pictures drawn so far, for screens whose picture was still being drawn when the
 * page loaded. Read fresh: the API's workflow draws them, and this app's cached lesson doesn't
 * have them yet (the public API's lesson read returns them as they're drawn).
 */
export async function getLessonPicturesAction(lessonId: string): Promise<LessonPicture[]> {
  if (!idSchema.safeParse(lessonId).success) {
    return [];
  }

  const { data, error } = await safeAsync(() => getLessonPictures({ lessonId }));

  if (error) {
    logError("[getLessonPicturesAction] Failed to read a lesson's pictures:", error);
    return [];
  }

  return data;
}
