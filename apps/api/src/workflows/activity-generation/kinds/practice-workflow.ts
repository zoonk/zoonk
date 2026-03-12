import { type ActivitySteps } from "../steps/_utils/get-activity-steps";
import { completeActivityStep } from "../steps/complete-activity-step";
import { type ExplanationResult } from "../steps/generate-explanation-content-step";
import { generatePracticeContentStep } from "../steps/generate-practice-content-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";

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

export async function practiceActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  explanationResults: ExplanationResult[],
  totalPractices: number,
): Promise<void> {
  "use workflow";

  const practiceIndices = Array.from({ length: totalPractices }, (_, i) => i);

  await Promise.allSettled(
    practiceIndices.map((practiceIndex) =>
      generatePracticeContentStep(
        activities,
        getExplanationStepsForPractice(explanationResults, practiceIndex, totalPractices),
        workflowRunId,
        practiceIndex,
      ),
    ),
  );

  await completeActivityStep(activities, workflowRunId, "practice");
}
