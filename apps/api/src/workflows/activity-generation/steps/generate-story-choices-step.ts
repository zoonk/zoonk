import { createEntityStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import {
  type ActivityStoryPlanSchema,
  type ActivityStorySchema,
} from "@zoonk/ai/tasks/activities/core/story";
import {
  buildActivityStoryWithChoices,
  generateActivityStoryChoices,
} from "@zoonk/ai/tasks/activities/core/story-choices";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Generates learner choices after the story skeleton exists.
 * The separate step gives answer masking and consequences a focused model call
 * while preserving the planned story order for image generation and saving.
 */
export async function generateStoryChoicesStep({
  activity,
  explanationSteps,
  storyPlan,
}: {
  activity: LessonActivity;
  explanationSteps: ActivitySteps;
  storyPlan: ActivityStoryPlanSchema;
}): Promise<ActivityStorySchema | null> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);
  await stream.status({ status: "started", step: "generateStoryChoices" });

  const lesson = activity.lesson;

  const { data: result, error } = await safeAsync(() =>
    generateActivityStoryChoices({
      chapterTitle: lesson.chapter.title,
      concepts: lesson.concepts,
      courseTitle: lesson.chapter.course.title,
      explanationSteps,
      language: activity.language,
      lessonDescription: lesson.description,
      storyPlan,
      topic: lesson.title,
    }),
  );

  if (error || !result) {
    const reason = getAIResultErrorReason({ error, result });

    await stream.error({ reason, step: "generateStoryChoices" });
    await handleActivityFailureStep({ activityId: activity.id });

    return null;
  }

  const { data: storyData, error: mergeError } = await safeAsync(async () =>
    buildActivityStoryWithChoices({ choices: result.data, storyPlan }),
  );

  if (mergeError || !storyData) {
    await stream.error({ reason: "contentValidationFailed", step: "generateStoryChoices" });
    await handleActivityFailureStep({ activityId: activity.id });

    return null;
  }

  await stream.status({ status: "completed", step: "generateStoryChoices" });

  return storyData;
}
