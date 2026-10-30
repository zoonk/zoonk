import { getWorkflowMetadata } from "workflow";
import { start } from "workflow/api";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { pullLessonStep } from "../quality/steps/later-review-steps";
import { listFlaggedContentStep, rewriteFlaggedDrillsStep } from "./steps/flagged-content-steps";

export type FlaggedContentResult = { drillsRewritten: number; lessonsPulled: string[] };

export async function flaggedContentWorkflow({
  flagIds,
}: { flagIds?: string[] } = {}): Promise<FlaggedContentResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const { drillGroups, lessonIds } = await listFlaggedContentStep({ flagIds });

  const pulled = await Promise.all(
    lessonIds.map(async (lessonId) => ((await pullLessonStep(lessonId)) ? [lessonId] : [])),
  );

  const lessonsPulled = pulled.flat();

  const [, rewritten] = await Promise.all([
    Promise.all(
      lessonsPulled.map((lessonId) =>
        start(lessonContentWorkflow, [{ forceReview: true, lessonId }]),
      ),
    ),
    Promise.allSettled(
      drillGroups.map((group) => rewriteFlaggedDrillsStep({ group, workflowRunId })),
    ),
  ]);

  const drillsRewritten = rewritten.reduce(
    (total, result) => total + (result.status === "fulfilled" ? result.value : 0),
    0,
  );

  return { drillsRewritten, lessonsPulled };
}
