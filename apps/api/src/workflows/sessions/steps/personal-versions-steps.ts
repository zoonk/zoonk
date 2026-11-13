import { getOrCreateStepVariant } from "@zoonk/core/library/variants/get-or-create";
import {
  type LearnerVersionTargets,
  type ToolVersionTarget,
  listLearnerVersionTargets,
} from "@zoonk/core/library/variants/version-targets";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";

export async function listLearnerVersionTargetsStep(input: {
  goalId: string;
  lessonIds: string[];
}): Promise<LearnerVersionTargets> {
  "use step";

  return listLearnerVersionTargets(input);
}

export async function prepareToolVersionStep({
  analytics,
  target,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  target: ToolVersionTarget;
  workflowRunId: string;
}): Promise<string> {
  "use step";

  const result = await getOrCreateStepVariant({
    analytics: toContentAnalytics({ analytics, scope: target, workflowRunId }),
    key: target.key,
    label: target.label,
    stepId: target.stepId,
    workflowRunId,
  });

  return result.status;
}
