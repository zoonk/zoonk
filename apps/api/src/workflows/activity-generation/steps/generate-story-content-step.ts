import { createEntityStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import {
  type ActivityStoryPlanSchema,
  generateActivityStory,
} from "@zoonk/ai/tasks/activities/core/story";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";

type StoryContentResult = {
  activityId: string | null;
  storyPlan: ActivityStoryPlanSchema | null;
};

/**
 * Generates the story skeleton before choices are added.
 * Story planning stays separate from answer-option writing so the second AI
 * task can focus on fair labels, consequences, and choice state prompts.
 */
export async function generateStoryContentStep(
  activities: LessonActivity[],
  explanationSteps: ActivitySteps,
): Promise<StoryContentResult> {
  "use step";

  const storyActivity = findActivityByKind(activities, "story");

  if (!storyActivity) {
    return { activityId: null, storyPlan: null };
  }

  await using stream = createEntityStepStream<ActivityStepName>(storyActivity.id);

  if (explanationSteps.length === 0) {
    throw new FatalError("Story generation needs explanation steps");
  }

  await stream.status({ status: "started", step: "generateStoryContent" });

  const lesson = storyActivity.lesson;
  const concepts = lesson.concepts;

  const { data: result, error } = await safeAsync(() =>
    generateActivityStory({
      chapterTitle: lesson.chapter.title,
      concepts,
      courseTitle: lesson.chapter.course.title,
      explanationSteps,
      language: storyActivity.language,
      lessonDescription: lesson.description,
      topic: lesson.title,
    }),
  );

  if (error || !result) {
    throw error ?? new Error(getAIResultErrorReason({ result }));
  }

  await stream.status({ status: "completed", step: "generateStoryContent" });

  return { activityId: storyActivity.id, storyPlan: result.data };
}
