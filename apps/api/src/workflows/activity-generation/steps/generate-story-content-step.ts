import { createEntityStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import {
  type ActivityStoryStepsSchema,
  generateActivityStorySteps,
} from "@zoonk/ai/tasks/activities/core/story-steps";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

type StoryContentResult = {
  activityId: string | null;
  storySteps: ActivityStoryStepsSchema | null;
  title: string | null;
};

/**
 * Generates the interactive story steps (intro, metrics, decision steps)
 * via AI. Returns the raw data without saving to the database.
 * The output is passed to `generateStoryDebriefStep` (which needs the
 * full steps context) and then to `saveStoryActivityStep` for persistence.
 *
 * Uses lesson concepts directly — story generation is independent of
 * explanation results.
 */
export async function generateStoryContentStep(
  activities: LessonActivity[],
): Promise<StoryContentResult> {
  "use step";

  const storyActivity = findActivityByKind(activities, "story");

  if (!storyActivity) {
    return { activityId: null, storySteps: null, title: null };
  }

  await using stream = createEntityStepStream<ActivityStepName>(storyActivity.id);

  await stream.status({ status: "started", step: "generateStoryContent" });

  const lesson = storyActivity.lesson;
  const concepts = lesson.concepts;

  const { data: result, error } = await safeAsync(() =>
    generateActivityStorySteps({
      chapterTitle: lesson.chapter.title,
      concepts,
      courseTitle: lesson.chapter.course.title,
      language: storyActivity.language,
      lessonDescription: lesson.description,
      topic: lesson.title,
    }),
  );

  if (error || !result || result.data.steps.length === 0) {
    const reason = getAIResultErrorReason({ error, result });

    await stream.error({ reason, step: "generateStoryContent" });
    await handleActivityFailureStep({ activityId: storyActivity.id });

    return { activityId: null, storySteps: null, title: null };
  }

  await stream.status({ status: "completed", step: "generateStoryContent" });

  return { activityId: storyActivity.id, storySteps: result.data, title: result.data.title };
}
