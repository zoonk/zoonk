import { releaseStaleLessonClaims } from "@zoonk/core/library/generation/state";

export async function failLessonContentStep(input: {
  lessonId: string;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await releaseStaleLessonClaims({ lessonId: input.lessonId, staleRunId: input.workflowRunId });
}
