import "server-only";
import { getLessonGenerationState } from "@zoonk/core/content/management";
import { triggerLessonPreload } from "./trigger-lesson-preload";

type LessonRegenerationCandidate = {
  generationStatus: "completed" | "failed" | "pending" | "running";
  generationVersion: number | null;
  id: number;
  kind: "core" | "custom" | "language";
  managementMode: "ai" | "manual" | "pinned";
};

/**
 * This helper exists so completion flows can enqueue regeneration with the
 * current lesson row they already loaded. That keeps the eligibility check
 * local to the mutation, while the shared preload trigger still owns the
 * network call. The call stays best-effort because regeneration is
 * maintenance work and should never block learner progress writes.
 */
export async function queueLessonRegeneration(input: {
  cookieHeader: string;
  lesson: LessonRegenerationCandidate;
}): Promise<void> {
  if (!getLessonGenerationState({ lesson: input.lesson }).shouldAutoEnqueueRegeneration) {
    return;
  }

  try {
    await triggerLessonPreload({ cookieHeader: input.cookieHeader, lessonId: input.lesson.id });
  } catch {
    // Regeneration is best-effort; silently ignore errors.
  }
}
