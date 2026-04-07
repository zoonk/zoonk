import { createEntityStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import {
  type ActivityInvestigationScenarioSchema,
  generateActivityInvestigationScenario,
} from "@zoonk/ai/tasks/activities/core/investigation-scenario";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

type InvestigationScenarioResult = {
  activityId: number | null;
  scenario: ActivityInvestigationScenarioSchema | null;
};

/**
 * Generates the scenario frame for an investigation activity via AI.
 * Produces a mystery scenario and possible explanations. This is the
 * first step in the investigation pipeline — subsequent steps (accuracy,
 * actions, findings, etc.) take this output as input.
 *
 * Returns the scenario data or null fields if generation fails.
 */
export async function generateInvestigationScenarioStep(
  activities: LessonActivity[],
): Promise<InvestigationScenarioResult> {
  "use step";

  const investigationActivity = findActivityByKind(activities, "investigation");

  if (!investigationActivity) {
    return { activityId: null, scenario: null };
  }

  await using stream = createEntityStepStream<ActivityStepName>(investigationActivity.id);

  await stream.status({ status: "started", step: "generateInvestigationScenario" });

  const lesson = investigationActivity.lesson;

  const { data: result, error } = await safeAsync(() =>
    generateActivityInvestigationScenario({
      chapterTitle: lesson.chapter.title,
      concepts: lesson.concepts,
      courseTitle: lesson.chapter.course.title,
      language: investigationActivity.language,
      lessonDescription: lesson.description,
      topic: lesson.title,
    }),
  );

  if (error || !result || result.data.explanations.length === 0) {
    const reason = getAIResultErrorReason({ error, result });

    await stream.error({ reason, step: "generateInvestigationScenario" });
    await handleActivityFailureStep({ activityId: investigationActivity.id });

    return { activityId: null, scenario: null };
  }

  await stream.status({ status: "completed", step: "generateInvestigationScenario" });

  return { activityId: Number(investigationActivity.id), scenario: result.data };
}
