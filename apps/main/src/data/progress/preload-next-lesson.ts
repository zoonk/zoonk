import { getNextLesson } from "./get-next-lesson";
import { triggerLessonPreload } from "./trigger-lesson-preload";

/**
 * Best-effort preloading of the next lesson's content.
 * Skips the HTTP call when the next lesson is already current,
 * or when another workflow run already owns the needed generation work.
 * Silently ignores errors since preloading is an optimization.
 */
export async function preloadNextLesson(activityId: bigint, cookieHeader: string): Promise<void> {
  const nextLesson = await getNextLesson(activityId);

  if (!nextLesson || !nextLesson.needsGeneration) {
    return;
  }

  try {
    await triggerLessonPreload({ cookieHeader, lessonId: nextLesson.id });
  } catch {
    // Preloading is best-effort; silently ignore errors.
  }
}
