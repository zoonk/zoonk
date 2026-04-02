import { createEntityStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import {
  type ActivityStoryDebriefSchema,
  generateActivityStoryDebrief,
} from "@zoonk/ai/tasks/activities/core/story-debrief";
import { type ActivityStoryStepsSchema } from "@zoonk/ai/tasks/activities/core/story-steps";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Generates outcomes and debrief concepts for a story activity via AI.
 * Takes the full steps output from `generateStoryContentStep` as input
 * so the debrief can reference specific story moments.
 *
 * Returns the debrief data or null if generation fails.
 */
export async function generateStoryDebriefStep({
  activityId,
  activitiesToGenerate,
  storySteps,
}: {
  activityId: number;
  activitiesToGenerate: LessonActivity[];
  storySteps: ActivityStoryStepsSchema;
}): Promise<ActivityStoryDebriefSchema | null> {
  "use step";

  const storyActivity = findActivityByKind(activitiesToGenerate, "story");

  if (!storyActivity) {
    return null;
  }

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "generateStoryDebrief" });

  const { data: result, error } = await safeAsync(() =>
    generateActivityStoryDebrief({
      concepts: storyActivity.lesson.concepts,
      language: storyActivity.language,
      storySteps,
      topic: storyActivity.lesson.title,
    }),
  );

  if (error || !result || result.data.outcomes.length === 0) {
    const reason = getAIResultErrorReason({ error, result });

    await stream.error({ reason, step: "generateStoryDebrief" });
    await handleActivityFailureStep({ activityId });

    return null;
  }

  await stream.status({ status: "completed", step: "generateStoryDebrief" });

  return result.data;
}
