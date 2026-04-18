import { findActivitiesByKind } from "../steps/_utils/find-activity-by-kind";
import { getExplanationStepsForPractice } from "../steps/_utils/get-explanation-steps-for-practice";
import { type ExplanationResult } from "../steps/generate-explanation-content-step";
import { generatePracticeContentStep } from "../steps/generate-practice-content-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { savePracticeActivityStep } from "../steps/save-practice-activity-step";

/**
 * Orchestrates practice activity generation.
 *
 * Flow per practice: generateContent -> save.
 * Each practice is independent — if one fails, others continue.
 * The save step writes steps and marks the activity as completed.
 *
 * Iterates over ALL practice activities (from allActivities) to compute
 * the correct explanation slice per practice index. Only generates content
 * for practices that appear in activitiesToGenerate — completed practices
 * are skipped.
 */
export async function practiceActivityWorkflow({
  activitiesToGenerate,
  allActivities,
  explanationResults,
  totalPractices,
  workflowRunId,
}: {
  activitiesToGenerate: LessonActivity[];
  allActivities: LessonActivity[];
  explanationResults: ExplanationResult[];
  totalPractices: number;
  workflowRunId: string;
}): Promise<void> {
  "use workflow";

  const allPractices = findActivitiesByKind(allActivities, "practice");
  const toGenerateIds = new Set(activitiesToGenerate.map((a) => a.id));

  await Promise.allSettled(
    allPractices.map(async (practice, practiceIndex) => {
      if (!toGenerateIds.has(practice.id)) {
        return;
      }

      const { activityId, steps, title } = await generatePracticeContentStep(
        allActivities,
        getExplanationStepsForPractice(explanationResults, practiceIndex, totalPractices),
        workflowRunId,
        practiceIndex,
      );

      if (!activityId || steps.length === 0 || !title) {
        return;
      }

      await savePracticeActivityStep({
        activityId,
        steps,
        title,
        workflowRunId,
      });
    }),
  );
}
