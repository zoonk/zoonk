"use server";

import { startLesson } from "@zoonk/core/player/commands/start-lesson";
import { logError } from "@zoonk/utils/logger";

/**
 * Records a lesson only after the playable client mounts so route prefetching
 * remains read-only. The core mutation resolves the current learner so callers
 * never supply the user id used by the analytics write.
 */
export async function recordLessonStart(lessonId: string): Promise<void> {
  try {
    await startLesson(lessonId);
  } catch (error) {
    logError("[recordLessonStart] Failed to persist lesson start:", error);
  }
}
