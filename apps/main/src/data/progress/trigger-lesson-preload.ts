import "server-only";
import { API_URL } from "@zoonk/utils/url";

/**
 * This helper exists so every lesson-preload caller shares the same trusted
 * POST shape. Callers still keep their own eligibility logic, but the actual
 * workflow trigger stays in one place.
 */
export async function triggerLessonPreload(input: {
  cookieHeader: string;
  lessonId: number;
}): Promise<void> {
  await fetch(`${API_URL}/v1/workflows/lesson-preload/trigger`, {
    body: JSON.stringify({ lessonId: input.lessonId }),
    headers: {
      "Content-Type": "application/json",
      Cookie: input.cookieHeader,
    },
    method: "POST",
  });
}
