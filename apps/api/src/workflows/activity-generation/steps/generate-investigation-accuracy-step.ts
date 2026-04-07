import { createEntityStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import {
  type ActivityInvestigationAccuracySchema,
  generateActivityInvestigationAccuracy,
} from "@zoonk/ai/tasks/activities/core/investigation-accuracy";
import { type ActivityInvestigationScenarioSchema } from "@zoonk/ai/tasks/activities/core/investigation-scenario";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Assigns accuracy tiers (best/partial/wrong) to each explanation
 * in the scenario. This runs separately from scenario generation
 * to avoid length bias — the scenario task writes explanations
 * without knowing which is "best".
 *
 * Returns the accuracy tiers or null if generation fails.
 */
export async function generateInvestigationAccuracyStep({
  activityId,
  activity,
  scenario,
}: {
  activityId: number;
  activity: LessonActivity;
  scenario: ActivityInvestigationScenarioSchema;
}): Promise<ActivityInvestigationAccuracySchema | null> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "generateInvestigationAccuracy" });

  const { data: result, error } = await safeAsync(() =>
    generateActivityInvestigationAccuracy({
      concepts: activity.lesson.concepts,
      language: activity.language,
      scenario,
      topic: activity.lesson.title,
    }),
  );

  if (error || !result) {
    const reason = getAIResultErrorReason({ error, result });

    await stream.error({ reason, step: "generateInvestigationAccuracy" });
    await handleActivityFailureStep({ activityId });

    return null;
  }

  await stream.status({ status: "completed", step: "generateInvestigationAccuracy" });

  return result.data;
}
