import { type ActivitySteps } from "../steps/_utils/get-activity-steps";
import { type ExplanationResult } from "../steps/generate-explanation-content-step";
import { generatePracticeContentStep } from "../steps/generate-practice-content-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { savePracticeActivityStep } from "../steps/save-practice-activity-step";

function getExplanationStepsForPractice(
  explanationResults: ExplanationResult[],
  practiceIndex: number,
  totalPractices: number,
): ActivitySteps {
  if (totalPractices <= 1) {
    return explanationResults.flatMap((result) => result.steps);
  }

  const splitIndex = Math.max(1, Math.floor(explanationResults.length / 2));

  const group =
    practiceIndex === 0
      ? explanationResults.slice(0, splitIndex)
      : explanationResults.slice(splitIndex);

  return group.flatMap((result) => result.steps);
}

/**
 * Orchestrates practice activity generation.
 *
 * Flow per practice: generateContent → save.
 * Each practice is independent — if one fails, others continue.
 * The save step writes steps and marks the activity as completed.
 */
export async function practiceActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  explanationResults: ExplanationResult[],
  totalPractices: number,
): Promise<void> {
  "use workflow";

  const practiceIndices = Array.from({ length: totalPractices }, (_, i) => i);

  await Promise.allSettled(
    practiceIndices.map(async (practiceIndex) => {
      const { activityId, steps } = await generatePracticeContentStep(
        activities,
        getExplanationStepsForPractice(explanationResults, practiceIndex, totalPractices),
        workflowRunId,
        practiceIndex,
      );

      if (!activityId || steps.length === 0) {
        return;
      }

      await savePracticeActivityStep({
        activityId,
        steps,
        workflowRunId,
      });
    }),
  );
}
