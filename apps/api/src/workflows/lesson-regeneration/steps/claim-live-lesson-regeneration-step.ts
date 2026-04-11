import { type LessonContext } from "@/workflows/lesson-generation/steps/get-lesson-step";
import { getTargetLessonGenerationVersion } from "@zoonk/core/content/management";
import { prisma } from "@zoonk/db";

/**
 * This step exists so duplicate lesson visits cannot start multiple regeneration
 * runs for the same live lesson. Regeneration keeps the published lesson
 * usable, so the claim flips one explicit `isRegenerating` flag instead of
 * restamping the live lesson as `running`. We still store the workflow run id
 * on the lesson because debugging production failures is much easier when the
 * lesson remembers which run last touched it. The update is intentionally
 * conditional on the lesson still being AI-managed, outdated, and not already
 * regenerating at the moment we write it, because the page-level check may
 * already be stale by the time the workflow starts.
 */
export async function claimLiveLessonRegenerationStep(input: {
  lesson: LessonContext;
  workflowRunId: string;
}): Promise<boolean> {
  "use step";

  const targetGenerationVersion = getTargetLessonGenerationVersion(input.lesson.kind);

  const result = await prisma.lesson.updateMany({
    data: {
      generationRunId: input.workflowRunId,
      isRegenerating: true,
    },
    where: {
      archivedAt: null,
      generationVersion: { not: targetGenerationVersion },
      id: input.lesson.id,
      isRegenerating: false,
      kind: input.lesson.kind,
      managementMode: "ai",
    },
  });

  return result.count === 1;
}
