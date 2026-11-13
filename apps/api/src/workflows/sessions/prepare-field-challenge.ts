import { getFieldChallengeToken } from "@zoonk/core/library/challenges/field-token";
import { type FieldChallengeTarget } from "@zoonk/core/library/variants/version-targets";
import { type ContentAnalytics, toContentAnalytics } from "../_shared/content-analytics";
import { claimRunToken } from "../_shared/run-token";
import { draftChallenge } from "../lessons/write-challenge-draft";
import {
  finishFieldChallengeDraftStep,
  prepareFieldChallengeDraftStep,
} from "./steps/field-challenge-steps";

export async function prepareFieldChallenge({
  analytics,
  target,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  target: FieldChallengeTarget;
  workflowRunId: string;
}): Promise<string> {
  using claim = await claimRunToken(getFieldChallengeToken(target));

  if (claim.conflict) {
    return "busy";
  }

  const input = { field: target.field, stepId: target.stepId, workflowRunId };

  const stage = await prepareFieldChallengeDraftStep({
    ...input,
    analytics: toContentAnalytics({ analytics, scope: target, workflowRunId }),
  });

  if (stage.status !== "challengeDraft") {
    return stage.status;
  }

  const draft = await draftChallenge({ stage });
  const result = await finishFieldChallengeDraftStep({ ...input, draft });

  return result.status;
}
