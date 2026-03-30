import { type ExplanationResult } from "../steps/generate-explanation-content-step";
import { generateTradeoffContentStep } from "../steps/generate-tradeoff-content-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveTradeoffActivityStep } from "../steps/save-tradeoff-activity-step";

/**
 * Orchestrates tradeoff activity generation.
 *
 * Flow: generateContent -> save.
 * The generate step calls the AI to produce a resource allocation scenario
 * with multiple rounds. The save step splits the output into individual
 * step records (intro + N rounds + reflection).
 *
 * Only generates for tradeoff activities in the activitiesToGenerate list.
 */
export async function tradeoffActivityWorkflow({
  activitiesToGenerate,
  explanationResults,
  workflowRunId,
}: {
  activitiesToGenerate: LessonActivity[];
  explanationResults: ExplanationResult[];
  workflowRunId: string;
}): Promise<void> {
  "use workflow";

  const explanationSteps = explanationResults.flatMap((result) => result.steps);
  const { activityId, content } = await generateTradeoffContentStep(
    activitiesToGenerate,
    explanationSteps,
    workflowRunId,
  );

  if (!activityId || !content) {
    return;
  }

  await saveTradeoffActivityStep({
    activityId,
    content,
    workflowRunId,
  });
}
