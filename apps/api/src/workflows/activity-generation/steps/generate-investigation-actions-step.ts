import { createEntityStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import { type ActivityInvestigationAccuracySchema } from "@zoonk/ai/tasks/activities/core/investigation-accuracy";
import {
  type ActivityInvestigationActionsSchema,
  generateActivityInvestigationActions,
} from "@zoonk/ai/tasks/activities/core/investigation-actions";
import { type ActivityInvestigationScenarioSchema } from "@zoonk/ai/tasks/activities/core/investigation-scenario";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Generates investigation actions (5-6 options with quality tiers)
 * that represent different angles the learner can investigate.
 *
 * Returns the actions or null if generation fails.
 */
export async function generateInvestigationActionsStep({
  activityId,
  accuracy,
  language,
  scenario,
}: {
  activityId: number;
  accuracy: ActivityInvestigationAccuracySchema;
  language: string;
  scenario: ActivityInvestigationScenarioSchema;
}): Promise<ActivityInvestigationActionsSchema | null> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "generateInvestigationActions" });

  const { data: result, error } = await safeAsync(() =>
    generateActivityInvestigationActions({
      accuracy,
      language,
      scenario,
    }),
  );

  if (error || !result || result.data.actions.length === 0) {
    const reason = getAIResultErrorReason({ error, result });

    await stream.error({ reason, step: "generateInvestigationActions" });
    await handleActivityFailureStep({ activityId });

    return null;
  }

  await stream.status({ status: "completed", step: "generateInvestigationActions" });

  return result.data;
}
