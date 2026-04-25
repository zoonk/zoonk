import { failActivityWorkflow } from "../handle-activity-workflow-error";
import { findActivitiesByKind } from "../steps/_utils/find-activity-by-kind";
import { getExplanationStepsForPractice } from "../steps/_utils/get-explanation-steps-for-practice";
import { getPracticeImagePrompts } from "../steps/_utils/get-practice-image-prompts";
import { generateActivityStepImagesStep } from "../steps/generate-activity-step-images-step";
import { type ExplanationResult } from "../steps/generate-explanation-content-step";
import { generatePracticeContentStep } from "../steps/generate-practice-content-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { savePracticeActivityStep } from "../steps/save-practice-activity-step";

/**
 * Orchestrates practice activity generation.
 *
 * Flow per practice: generateContent -> generateStepImages -> save.
 * Each practice is independent — if one fails, others continue.
 * The save step writes the image-led scenario/question steps and marks the
 * activity as completed.
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

      try {
        const { activityId, scenario, steps, title } = await generatePracticeContentStep(
          allActivities,
          getExplanationStepsForPractice(explanationResults, practiceIndex, totalPractices),
          workflowRunId,
          practiceIndex,
        );

        if (!activityId || !scenario || steps.length === 0 || !title) {
          throw new Error("Practice content step returned incomplete content");
        }

        const { images } = await generateActivityStepImagesStep(
          practice,
          getPracticeImagePrompts({ scenario, steps }),
        );

        await savePracticeActivityStep({
          activityId,
          images,
          scenario,
          steps,
          title,
          workflowRunId,
        });
      } catch (error) {
        await failActivityWorkflow({ activityId: practice.id, error });
      }
    }),
  );
}
