import { logError } from "@zoonk/utils/logger";

/**
 * Sends the after-mount lesson-start write through a plain HTTP response. A
 * Server Action response participates in the React Flight protocol and can
 * replace an active runtime-prefetched lesson while its route params are still
 * resolving, while this transport cannot carry a replacement component tree.
 */
export async function recordLessonStart(lessonId: string): Promise<void> {
  try {
    const response = await fetch(`/api/lessons/${encodeURIComponent(lessonId)}/starts`, {
      keepalive: true,
      method: "POST",
    });

    if (!response.ok) {
      logError("[recordLessonStart] Failed to persist lesson start:", response.status);
    }
  } catch (error) {
    logError("[recordLessonStart] Failed to persist lesson start:", error);
  }
}
