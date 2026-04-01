import { generateStoryContentStep } from "../steps/generate-story-content-step";
import { generateStoryDebriefStep } from "../steps/generate-story-debrief-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveStoryActivityStep } from "../steps/save-story-activity-step";

/**
 * Orchestrates story activity generation.
 *
 * Flow: generateContent -> generateDebrief -> save.
 * The two generate steps are sequential because the debrief
 * needs the full story steps output to reference specific
 * moments. The save step writes everything at once.
 *
 * Uses lesson concepts directly — story generation is
 * independent of explanation results, so it runs in wave 1
 * alongside explanations.
 */
export async function storyActivityWorkflow({
  activitiesToGenerate,
  workflowRunId,
}: {
  activitiesToGenerate: LessonActivity[];
  workflowRunId: string;
}): Promise<void> {
  "use workflow";

  const { activityId, storySteps } = await generateStoryContentStep(activitiesToGenerate);

  if (!activityId || !storySteps) {
    return;
  }

  const debriefData = await generateStoryDebriefStep({
    activitiesToGenerate,
    activityId,
    storySteps,
  });

  if (!debriefData) {
    return;
  }

  await saveStoryActivityStep({ activityId, debriefData, storySteps, workflowRunId });
}
