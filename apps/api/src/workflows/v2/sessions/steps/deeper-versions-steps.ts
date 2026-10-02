import {
  type DeeperVersionTarget,
  listDeeperVersionTargets,
} from "@zoonk/core/library/variants/deeper-targets";
import { getOrCreateStepVariant } from "@zoonk/core/library/variants/get-or-create";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";

export async function listDeeperVersionTargetsStep(input: {
  lessonIds: string[];
  userId: string;
}): Promise<DeeperVersionTarget[]> {
  "use step";

  return listDeeperVersionTargets(input);
}

/**
 * Writes the shared "Go deeper" version of one explanation, so a learner whose lessons open that
 * version first doesn't wait for it. A draft that fails its checks leaves the base screen showing.
 */
export async function prepareDeeperVersionStep({
  analytics,
  target,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  target: DeeperVersionTarget;
  workflowRunId: string;
}): Promise<string> {
  "use step";

  const result = await withAiRetry(() =>
    getOrCreateStepVariant({
      analytics: toContentAnalytics({ analytics, scope: target, workflowRunId }),
      kind: "deeper",
      stepId: target.stepId,
    }),
  );

  return result.status;
}
