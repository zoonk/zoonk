import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { buildExplanationActivitySteps } from "./_utils/build-explanation-activity-plan";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";

export type ExplanationResult = {
  activityId: string;
  concept: string;
  steps: ActivitySteps;
};
export type GeneratedExplanationResult = ExplanationResult;

/**
 * Explanation activities are planned before this step runs, so the AI call
 * needs the current activity title, its short goal, and the lesson's concept
 * pool. This helper keeps that translation in one place before the workflow
 * fans out.
 */
async function generateSingleExplanation({
  activity,
  lessonConcepts,
  otherExplanationTitles,
}: {
  activity: LessonActivity;
  lessonConcepts: string[];
  otherExplanationTitles: string[];
}): Promise<GeneratedExplanationResult> {
  const activityTitle = activity.title ?? activity.lesson.title;
  const activityGoal = activity.description ?? activityTitle;

  const result = await generateActivityExplanation({
    activityGoal,
    activityTitle,
    chapterTitle: activity.lesson.chapter.title,
    courseTitle: activity.lesson.chapter.course.title,
    language: activity.language,
    lessonConcepts,
    lessonDescription: activity.lesson.description ?? "",
    lessonTitle: activity.lesson.title,
    otherActivityTitles: otherExplanationTitles,
  });

  if (!result?.data) {
    throw new Error("Empty AI result for explanation content");
  }

  const steps = buildExplanationActivitySteps(result.data);

  if (steps.length === 0) {
    throw new Error("Empty explanation activity steps");
  }

  return {
    activityId: activity.id,
    concept: activityTitle,
    steps,
  };
}

/**
 * Sibling explanation titles help the model stay in its lane instead of
 * re-explaining the same angle with slightly different wording.
 */
function getOtherExplanationTitles({
  activities,
  currentActivityId,
}: {
  activities: LessonActivity[];
  currentActivityId: string;
}): string[] {
  return activities.flatMap((activity) =>
    activity.kind === "explanation" &&
    activity.id !== currentActivityId &&
    typeof activity.title === "string" &&
    activity.title.length > 0
      ? [activity.title]
      : [],
  );
}

/**
 * Generates explanation content for one explanation activity.
 * Returns the raw content data without saving to the database.
 *
 * The caller fans out per activity at the workflow level so one failed
 * explanation can be retried and marked failed without affecting sibling
 * explanations.
 */
export async function generateExplanationContentStep({
  activity,
  allActivities,
  lessonConcepts,
}: {
  activity: LessonActivity;
  allActivities: LessonActivity[];
  lessonConcepts: string[];
}): Promise<GeneratedExplanationResult> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  await stream.status({ status: "started", step: "generateExplanationContent" });

  const result = await generateSingleExplanation({
    activity,
    lessonConcepts,
    otherExplanationTitles: getOtherExplanationTitles({
      activities: allActivities,
      currentActivityId: activity.id,
    }),
  });

  await stream.status({ status: "completed", step: "generateExplanationContent" });
  return result;
}
