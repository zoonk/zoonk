import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { failLessonContentStep } from "./steps/fail-lesson-content-step";
import { writeLessonSpecStep } from "./steps/write-lesson-spec-step";

export type LessonSpecsInput = { analytics?: ContentAnalytics; lessonIds: string[] };

export type LessonSpecsResult = { failed: number; planned: number; skipped: number };

/**
 * Plans a chapter's lessons ahead of the learner: when they start a chapter, the next one gets its
 * specs, so its lessons can be written the moment they're needed. Lessons are planned in parallel
 * steps; one that fails frees its claim for the next run and counts as a failed generation, and a
 * lesson another run is planning is left to it.
 */
export async function lessonSpecsWorkflow({
  analytics,
  lessonIds,
}: LessonSpecsInput): Promise<LessonSpecsResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const outcomes = await Promise.allSettled(
    lessonIds.map((lessonId) => writeLessonSpecStep({ analytics, lessonId, workflowRunId })),
  );

  const failedIds = lessonIds.filter((_, index) => outcomes[index]?.status === "rejected");

  await Promise.all(
    failedIds.flatMap((lessonId) => [
      failLessonContentStep({ lessonId, workflowRunId }),
      trackGenerationFailedStep({ analytics, contentKind: "lesson", task: "lesson-specs" }),
    ]),
  );

  return {
    failed: failedIds.length,
    planned: outcomes.filter(
      (outcome) => outcome.status === "fulfilled" && outcome.value === "ready",
    ).length,
    skipped: outcomes.filter(
      (outcome) => outcome.status === "fulfilled" && outcome.value !== "ready",
    ).length,
  };
}
