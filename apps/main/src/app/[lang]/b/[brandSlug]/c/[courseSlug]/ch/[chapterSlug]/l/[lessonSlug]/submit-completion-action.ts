"use server";

import { getCourseLearningPath } from "@zoonk/core/courses/learning-plan";
import { completeLesson } from "@zoonk/core/player/commands/create-lesson-completion";
import {
  type CompletionInput,
  completionInputSchema,
} from "@zoonk/core/player/contracts/completion-input-schema";
import { logError } from "@zoonk/utils/logger";
import { revalidatePath } from "next/cache";

/** Saves an idempotent completion before returning rewards and refreshed learning context. */
export async function submitCompletion(rawInput: CompletionInput, courseId: string) {
  const parsed = completionInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return { status: "failed" as const };
  }

  try {
    const result = await completeLesson(parsed.data);

    if (result.status === "superseded") {
      return result;
    }

    if (result.status !== "completed") {
      return { status: "failed" as const };
    }

    revalidatePath("/[lang]/(catalog)", "layout");
    revalidatePath("/[lang]/(progress)", "layout");
    const context = await getCompletionContext({ courseId, lessonId: parsed.data.lessonId });
    return { ...context, result: result.result, status: "completed" as const };
  } catch (error) {
    logError("[submitCompletion] Failed to persist lesson completion:", error);
    return { status: "failed" as const };
  }
}

async function getCompletionContext({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}) {
  try {
    const path = await getCourseLearningPath({ courseId });

    const chapter =
      path.status === "ready"
        ? path.chapters.find((item) => item.lessons.some((lesson) => lesson.id === lessonId))
        : null;

    const pathCompleted =
      path.status === "ready" &&
      path.progress.totalChapters > 0 &&
      path.progress.completedChapters === path.progress.totalChapters;

    let completionMilestone: "chapter" | "course" | null = null;

    if (chapter?.isCompleted) {
      completionMilestone = pathCompleted ? "course" : "chapter";
    }

    return {
      completionMilestone,
      nextTarget: chapter && path.status === "ready" ? path.nextTarget : null,
    };
  } catch (error) {
    logError("[submitCompletion] Could not refresh learning context:", error);
    return { completionMilestone: null, nextTarget: null };
  }
}
