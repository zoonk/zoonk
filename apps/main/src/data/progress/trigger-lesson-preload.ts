import "server-only";
import { triggerWorkflow } from "./trigger-workflow";

/**
 * This helper exists so every lesson-preload caller shares the same trusted
 * POST shape. Callers still keep their own eligibility logic, but the actual
 * workflow trigger stays in one place.
 */
export async function triggerLessonPreload(input: {
  cookieHeader: string;
  lessonId: string;
}): Promise<void> {
  await triggerWorkflow({
    body: { lessonId: input.lessonId },
    cookieHeader: input.cookieHeader,
    endpoint: "/v1/workflows/lesson-preload/trigger",
    failureContext: { lessonId: input.lessonId },
    logPrefix: "[triggerLessonPreload] Workflow trigger failed:",
  });
}
