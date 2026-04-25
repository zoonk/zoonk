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

/**
 * Generates deliberately ambiguous findings for each investigation action.
 * Each finding has a complicating factor that makes interpretation non-trivial.
 *
 * Throws on generation failure so Workflow can retry before the activity is
 * marked permanently failed by the workflow catch.
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
}): Promise<ActivityInvestigationFindingsSchema> {
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
    throw error ?? new Error(getAIResultErrorReason({ result }));
  }

  await stream.status({ status: "completed", step: "generateInvestigationFindings" });

  return result.data;
}
