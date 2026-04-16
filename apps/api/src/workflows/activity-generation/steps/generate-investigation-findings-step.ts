import { createEntityStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import { type ActivityInvestigationAccuracySchema } from "@zoonk/ai/tasks/activities/core/investigation-accuracy";
import { type ActivityInvestigationActionsSchema } from "@zoonk/ai/tasks/activities/core/investigation-actions";
import {
  type ActivityInvestigationFindingsSchema,
  generateActivityInvestigationFindings,
} from "@zoonk/ai/tasks/activities/core/investigation-findings";
import { type ActivityInvestigationScenarioSchema } from "@zoonk/ai/tasks/activities/core/investigation-scenario";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Generates deliberately ambiguous findings for each investigation action.
 * Each finding has a complicating factor that makes interpretation non-trivial.
 *
 * Returns the findings or null if generation fails.
 */
export async function generateInvestigationFindingsStep({
  activityId,
  accuracy,
  actions,
  language,
  scenario,
}: {
  activityId: string;
  accuracy: ActivityInvestigationAccuracySchema;
  actions: ActivityInvestigationActionsSchema;
  language: string;
  scenario: ActivityInvestigationScenarioSchema;
}): Promise<ActivityInvestigationFindingsSchema | null> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "generateInvestigationFindings" });

  const { data: result, error } = await safeAsync(() =>
    generateActivityInvestigationFindings({
      accuracy,
      actions,
      language,
      scenario,
    }),
  );

  if (error || !result || result.data.findings.length === 0) {
    const reason = getAIResultErrorReason({ error, result });

    await stream.error({ reason, step: "generateInvestigationFindings" });
    await handleActivityFailureStep({ activityId });

    return null;
  }

  await stream.status({ status: "completed", step: "generateInvestigationFindings" });

  return result.data;
}
