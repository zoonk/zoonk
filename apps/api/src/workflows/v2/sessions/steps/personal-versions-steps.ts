import { getOrCreateFieldChallenge } from "@zoonk/core/library/challenges/field-challenge";
import { getOrCreateStepVariant } from "@zoonk/core/library/variants/get-or-create";
import {
  type FieldChallengeTarget,
  type LearnerVersionTargets,
  type ToolVersionTarget,
  listLearnerVersionTargets,
} from "@zoonk/core/library/variants/version-targets";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";

export async function listLearnerVersionTargetsStep(input: {
  goalId: string;
  lessonIds: string[];
}): Promise<LearnerVersionTargets> {
  "use step";

  return listLearnerVersionTargets(input);
}

/**
 * Writes one hands-on screen in the learner's tool, or as examples for a learner who installs
 * nothing. Shared by every learner with the same tool; a draft that fails its checks leaves the
 * shared screen in place.
 */
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

  const result = await withAiRetry(() =>
    getOrCreateStepVariant({
      analytics: toContentAnalytics({ analytics, scope: target, workflowRunId }),
      key: target.key,
      kind: "tool",
      label: target.label,
      stepId: target.stepId,
    }),
  );

  return result.status;
}

/**
 * Writes a chapter's work case set in the learner's field, shared by everyone in that field. A
 * case that fails its checks leaves the general case in place.
 */
export async function prepareFieldChallengeStep({
  analytics,
  target,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  target: FieldChallengeTarget;
  workflowRunId: string;
}): Promise<string> {
  "use step";

  const result = await withAiRetry(() =>
    getOrCreateFieldChallenge({
      analytics: toContentAnalytics({ analytics, scope: target, workflowRunId }),
      field: target.field,
      stepId: target.stepId,
    }),
  );

  return result.status;
}
