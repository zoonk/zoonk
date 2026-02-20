import { API_URL } from "@zoonk/utils/constants";
import { getNextLessonId } from "./get-next-lesson-id";

/**
 * Best-effort preloading of the next lesson's content.
 * Silently ignores errors since preloading is an optimization.
 */
export async function preloadNextLesson(activityId: bigint, cookieHeader: string): Promise<void> {
  const nextLessonId = await getNextLessonId(activityId);

  if (!nextLessonId) {
    return;
  }

  try {
    await fetch(`${API_URL}/v1/workflows/lesson-preload/trigger`, {
      body: JSON.stringify({ lessonId: nextLessonId }),
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      method: "POST",
    });
  } catch {
    // Preloading is best-effort; silently ignore errors.
  }
}
