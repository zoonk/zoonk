import { createEntityStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import {
  type ActivityPracticeSchema,
  generateActivityPractice,
} from "@zoonk/ai/tasks/activities/core/practice";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { findActivitiesByKind } from "./_utils/find-activity-by-kind";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";

export type PracticeScenario = ActivityPracticeSchema["scenario"];
export type PracticeStep = ActivityPracticeSchema["steps"][number];

/**
 * Generates the practice scenario and question steps from explanation content via AI.
 * Returns the raw activity payload without saving to the database.
 * The scenario and steps will be passed to `savePracticeActivityStep` for persistence.
 *
 * No status checks — the caller only passes activities that need generation.
 * Empty explanation data is a permanent dependency failure, so that case uses
 * `FatalError`. AI/provider errors still throw the original error so Workflow
 * retries the practice step before the activity is marked failed.
 */
export async function generatePracticeContentStep(
  activities: LessonActivity[],
  explanationSteps: ActivitySteps,
  workflowRunId: string,
  practiceIndex = 0,
): Promise<{
  activityId: string | null;
  scenario: PracticeScenario | null;
  steps: PracticeStep[];
  title: string | null;
}> {
  "use step";

  const practiceActivity = findActivitiesByKind(activities, "practice")[practiceIndex];

  if (!practiceActivity) {
    return { activityId: null, scenario: null, steps: [], title: null };
  }

  if (explanationSteps.length === 0) {
    throw new FatalError("Practice generation needs explanation steps");
  }

  await using stream = createEntityStepStream<ActivityStepName>(practiceActivity.id);

  await stream.status({ status: "started", step: "generatePracticeContent" });

  const { data: result, error }: SafeReturn<{ data: ActivityPracticeSchema }> = await safeAsync(
    () =>
      generateActivityPractice({
        chapterTitle: practiceActivity.lesson.chapter.title,
        courseTitle: practiceActivity.lesson.chapter.course.title,
        explanationSteps,
        language: practiceActivity.language,
        lessonDescription: practiceActivity.lesson.description ?? "",
        lessonTitle: practiceActivity.lesson.title,
      }),
  );

  if (error || !result || result.data.steps.length === 0) {
    throw error ?? new Error(getAIResultErrorReason({ result }));
  }

  await stream.status({ status: "completed", step: "generatePracticeContent" });
  return {
    activityId: practiceActivity.id,
    scenario: result.data.scenario,
    steps: result.data.steps,
    title: result.data.title,
  };
}
