import { createEntityStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import { type ActivityInvestigationAccuracySchema } from "@zoonk/ai/tasks/activities/core/investigation-accuracy";
import {
  type ActivityInvestigationActionsSchema,
  generateActivityInvestigationActions,
} from "@zoonk/ai/tasks/activities/core/investigation-actions";
import { type ActivityInvestigationScenarioSchema } from "@zoonk/ai/tasks/activities/core/investigation-scenario";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";

/**
 * Generates investigation actions (5-6 options with quality tiers)
 * that represent different angles the learner can investigate.
 *
 * Throws on generation failure so Workflow can retry before the activity is
 * marked permanently failed by the workflow catch.
 */
export async function generateInvestigationActionsStep({
  activityId,
  accuracy,
  language,
  scenario,
}: {
  activityId: string;
  accuracy: ActivityInvestigationAccuracySchema;
  language: string;
  scenario: ActivityInvestigationScenarioSchema;
}): Promise<ActivityInvestigationActionsSchema> {
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
    throw error ?? new Error(getAIResultErrorReason({ result }));
  }

  await stream.status({ status: "completed", step: "generateInvestigationActions" });

  return result.data;
}
