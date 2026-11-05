"use server";

import { completeLibraryLesson } from "@zoonk/core/lesson-player/complete";
import { libraryLessonCompletionInputSchema } from "@zoonk/core/lesson-player/completion-input-contract";
import { getLessonMarks } from "@zoonk/core/lesson-player/marks";
import { getLessonPictures } from "@zoonk/core/lesson-player/pictures";
import { type LessonMarks, type LessonPicture } from "@zoonk/core/lesson-player/playable-lesson";
import { type LessonCompletionOutcome } from "@zoonk/player/lesson/types";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { z } from "zod";

const idSchema = z.uuid();
const stepIdsSchema = z.array(z.uuid()).optional();

export async function completeLibraryLessonAction({
  lessonId,
  ...rawInput
}: {
  lessonId: string;
  runId: string;
  skippedWritingStepIds?: string[];
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

/** Read fresh: the API's workflow draws the pictures, and this app's cached lesson doesn't have them yet. */
export async function getLessonPicturesAction(
  lessonId: string,
  stepIds?: unknown,
): Promise<LessonPicture[]> {
  const steps = stepIdsSchema.safeParse(stepIds);

  if (!idSchema.safeParse(lessonId).success || !steps.success) {
    return [];
  }

  const { data, error } = await safeAsync(() =>
    getLessonPictures({ lessonId, stepIds: steps.data }),
  );

  if (error) {
    logError("[getLessonPicturesAction] Failed to read a lesson's pictures:", error);
    return [];
  }

  return data;
}

/** Polled while the lesson's marks are on their way; the API's workflow writes them. */
export async function getLessonMarksAction(lessonId: string): Promise<LessonMarks | null> {
  if (!idSchema.safeParse(lessonId).success) {
    return null;
  }

  const { data, error } = await safeAsync(() => getLessonMarks({ lessonId }));

  if (error) {
    logError("[getLessonMarksAction] Failed to read a lesson's marks:", error);
    return null;
  }

  return data;
}
