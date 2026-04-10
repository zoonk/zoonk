import { type LessonContext } from "@/workflows/lesson-generation/steps/get-lesson-step";
import { getTargetLessonGenerationVersion } from "@zoonk/core/content/management";
import { prisma } from "@zoonk/db";

/**
 * This step exists so duplicate lesson visits cannot start multiple regeneration
 * runs for the same live lesson. The update is intentionally conditional on the
 * lesson still being AI-managed, outdated, and not already `running` at the
 * moment we claim it, because the page-level check may already be stale by the
 * time the workflow starts.
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
      generationStatus: "running",
    },
    where: {
      archivedAt: null,
      generationStatus: { not: "running" },
      generationVersion: { not: targetGenerationVersion },
      id: input.lesson.id,
      kind: input.lesson.kind,
      managementMode: "ai",
    },
  });

  return result.count === 1;
}
