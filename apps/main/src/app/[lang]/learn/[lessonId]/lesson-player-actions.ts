"use server";

import { completeLibraryLesson } from "@zoonk/core/lesson-player/complete";
import { libraryLessonCompletionInputSchema } from "@zoonk/core/lesson-player/completion-input-contract";
import { type LessonPicture } from "@zoonk/core/lesson-player/contract";
import { getLessonPictures } from "@zoonk/core/lesson-player/pictures";
import { type LessonCompletionOutcome } from "@zoonk/player/lesson/types";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { z } from "zod";

const idSchema = z.uuid();

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
