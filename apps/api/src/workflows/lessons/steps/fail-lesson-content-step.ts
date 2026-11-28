import { releaseStaleLessonClaims } from "@zoonk/core/library/generation/state";

export async function failLessonContentStep(input: {
  lessonId: string;
  setAside?: boolean;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await releaseStaleLessonClaims({
    lessonId: input.lessonId,
    setAside: input.setAside,
    staleRunId: input.workflowRunId,
  });
}
