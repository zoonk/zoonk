import { releaseStaleLessonClaims } from "@zoonk/core/library/generation/state";

/**
 * Ends this run's spec and content claims as failed after its steps gave up, so the next request
 * claims the lesson again instead of waiting on a run that will never finish it.
 */
export async function failLessonContentStep(input: {
  lessonId: string;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await releaseStaleLessonClaims({ lessonId: input.lessonId, staleRunId: input.workflowRunId });
}
