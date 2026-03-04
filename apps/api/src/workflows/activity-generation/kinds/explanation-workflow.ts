import { settled } from "@zoonk/utils/settled";
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

  const visualResults = await Promise.allSettled(
    explanationEntries.map((entry) =>
      generateVisualsForActivityStep(entry.activity, entry.result.steps),
    ),
  );

  const imagePromises = explanationEntries.flatMap((entry, index) => {
    const visualResult = visualResults[index];
    const visuals = visualResult ? settled(visualResult, { visuals: [] }).visuals : [];
    if (visuals.length === 0) {
      return [];
    }
    return [generateImagesForActivityStep(entry.activity, visuals)];
  });

  await Promise.allSettled(imagePromises);
  await completeActivityStep(activities, workflowRunId, "explanation");

  return { results };
}
