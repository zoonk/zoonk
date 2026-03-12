import { type ActivitySteps } from "../steps/_utils/get-activity-steps";
import { completeActivityStep } from "../steps/complete-activity-step";
import { type ExplanationResult } from "../steps/generate-explanation-content-step";
import { generateStoryContentStep } from "../steps/generate-story-content-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";

function getExplanationStepsForStory(
  explanationResults: ExplanationResult[],
  storyIndex: number,
  totalStories: number,
): ActivitySteps {
  if (totalStories <= 1) {
    return explanationResults.flatMap((result) => result.steps);
  }

  const splitIndex = Math.max(1, Math.floor(explanationResults.length / 2));

  const group =
    storyIndex === 0
      ? explanationResults.slice(0, splitIndex)
      : explanationResults.slice(splitIndex);

  return group.flatMap((result) => result.steps);
}

export async function storyActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  explanationResults: ExplanationResult[],
  totalStories: number,
): Promise<void> {
  "use workflow";

  const storyIndices = Array.from({ length: totalStories }, (_, i) => i);

  await Promise.allSettled(
    storyIndices.map((storyIndex) =>
      generateStoryContentStep(
        activities,
        getExplanationStepsForStory(explanationResults, storyIndex, totalStories),
        workflowRunId,
        storyIndex,
      ),
    ),
  );

  await completeActivityStep(activities, workflowRunId, "story");
}
