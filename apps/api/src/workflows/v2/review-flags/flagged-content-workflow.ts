import { getWorkflowMetadata } from "workflow";
import { start } from "workflow/api";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { pullLessonStep } from "../quality/steps/later-review-steps";
import { listFlaggedContentStep, rewriteFlaggedDrillsStep } from "./steps/flagged-content-steps";

export type FlaggedContentResult = { drillsRewritten: number; lessonsPulled: string[] };

/**
 * Rewrites what was built on a source before it changed. A flagged lesson is taken out of play and
 * written again from its sources as they are now, with the reasoning check, and saving it resolves
 * its flags. Drills on a changed law's articles are written again from the new text in place. The
 * daily sweep runs it for every open flag (a bounded batch a day); an admin's "Rewrite now" runs it
 * for one flag.
 */
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
