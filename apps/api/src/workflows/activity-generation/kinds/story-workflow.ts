import { findActivityByKind } from "../steps/_utils/find-activity-by-kind";
import { type ActivitySteps } from "../steps/_utils/get-activity-steps";
import { generateStoryChoicesStep } from "../steps/generate-story-choices-step";
import { generateStoryContentStep } from "../steps/generate-story-content-step";
import { generateStoryImagesStep } from "../steps/generate-story-images-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { handleActivityFailureStep } from "../steps/handle-failure-step";
import { saveStoryActivityStep } from "../steps/save-story-activity-step";

/**
 * Orchestrates story activity generation.
 *
 * Flow: generateContent -> generateChoices -> generateImages -> save.
 * The story planner creates the applied case first, then the choice task
 * writes learner decisions before images and save consume the full payload.
 *
 * Story generation uses the normalized explanation steps the learner has
 * already seen so the applied scenario stays coherent with the lesson flow.
 */
export async function storyActivityWorkflow({
  activitiesToGenerate,
  explanationSteps,
  workflowRunId,
}: {
  activitiesToGenerate: LessonActivity[];
  explanationSteps: ActivitySteps;
  workflowRunId: string;
}): Promise<void> {
  "use workflow";

  const storyActivity = findActivityByKind(activitiesToGenerate, "story");

  if (!storyActivity) {
    return;
  }

  try {
    const { activityId, storyPlan } = await generateStoryContentStep(
      activitiesToGenerate,
      explanationSteps,
    );

    if (!activityId || !storyPlan) {
      return;
    }

    const storyData = await generateStoryChoicesStep({
      activity: storyActivity,
      explanationSteps,
      storyPlan,
    });

    if (!storyData) {
      return;
    }

    const storyImages = await generateStoryImagesStep({
      activity: storyActivity,
      storyData,
    });

    await saveStoryActivityStep({
      activityId,
      storyData,
      storyImages,
      workflowRunId,
    });
  } catch {
    await handleActivityFailureStep({ activityId: storyActivity.id });
  }
}
