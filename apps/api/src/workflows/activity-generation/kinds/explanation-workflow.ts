import { completeActivityStep } from "../steps/complete-activity-step";
import {
  type ExplanationResult,
  generateExplanationContentStep,
} from "../steps/generate-explanation-content-step";
import { generateImagesForActivityStep } from "../steps/generate-images-step";
import { generateVisualsForActivityStep } from "../steps/generate-visuals-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";

export async function explanationActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  concepts: string[],
  neighboringConcepts: string[],
): Promise<{ results: ExplanationResult[] }> {
  "use workflow";

  const { results } = await generateExplanationContentStep(
    activities,
    concepts,
    neighboringConcepts,
    workflowRunId,
  );

  const explanationEntries = results.flatMap((result) => {
    const activity = activities.find((a) => a.id === result.activityId);
    if (!activity || result.steps.length === 0) {
      return [];
    }
    return [{ activity, result }];
  });

  await Promise.allSettled(
    explanationEntries.map(async (entry) => {
      const visualResult = await generateVisualsForActivityStep(entry.activity, entry.result.steps);
      await generateImagesForActivityStep(entry.activity, visualResult.visuals);
    }),
  );

  await completeActivityStep(activities, workflowRunId, "explanation");

  return { results };
}
