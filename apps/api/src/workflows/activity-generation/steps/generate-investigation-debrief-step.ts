import { createEntityStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import { type ActivityInvestigationAccuracySchema } from "@zoonk/ai/tasks/activities/core/investigation-accuracy";
import { type ActivityInvestigationActionsSchema } from "@zoonk/ai/tasks/activities/core/investigation-actions";
import {
  type ActivityInvestigationDebriefSchema,
  generateActivityInvestigationDebrief,
} from "@zoonk/ai/tasks/activities/core/investigation-debrief";
import { type ActivityInvestigationFindingsSchema } from "@zoonk/ai/tasks/activities/core/investigation-findings";
import { type ActivityInvestigationScenarioSchema } from "@zoonk/ai/tasks/activities/core/investigation-scenario";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Generates the debrief explanation — the "aha moment" reveal shown
 * after the learner makes their final call. Produces a 2-3 sentence
 * explanation of what actually happened and why.
 *
 * Returns the debrief data or null if generation fails.
 */
export async function generateInvestigationDebriefStep({
  activityId,
  accuracy,
  actions,
  findings,
  language,
  scenario,
}: {
  activityId: number;
  accuracy: ActivityInvestigationAccuracySchema;
  actions: ActivityInvestigationActionsSchema;
  findings: ActivityInvestigationFindingsSchema;
  language: string;
  scenario: ActivityInvestigationScenarioSchema;
}): Promise<ActivityInvestigationDebriefSchema | null> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "generateInvestigationDebrief" });

  const { data: result, error } = await safeAsync(() =>
    generateActivityInvestigationDebrief({
      accuracy,
      actions,
      findings,
      language,
      scenario,
    }),
  );

  if (error || !result) {
    const reason = getAIResultErrorReason({ error, result });

    await stream.error({ reason, step: "generateInvestigationDebrief" });
    await handleActivityFailureStep({ activityId });

    return null;
  }

  await stream.status({ status: "completed", step: "generateInvestigationDebrief" });

  return result.data;
}
