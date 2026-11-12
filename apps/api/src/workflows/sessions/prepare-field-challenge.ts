import { getFieldChallengeToken } from "@zoonk/core/library/challenges/field-token";
import { type FieldChallengeTarget } from "@zoonk/core/library/variants/version-targets";
import { type ContentAnalytics, toContentAnalytics } from "../_shared/content-analytics";
import { claimRunToken } from "../_shared/run-token";
import {
  planChallengeStep,
  reviewChallengeStep,
  scriptChallengeStep,
} from "../lessons/steps/challenge-draft-steps";
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

  const planned = await planChallengeStep({ stage });

  if (planned.problems.length > 0) {
    const result = await finishFieldChallengeDraftStep({
      ...input,
      model: planned.provenance.model,
      problems: planned.problems,
    });

    return result.status;
  }

  const scripted = await scriptChallengeStep({ planned, stage });

  const problems =
    scripted.problems.length > 0
      ? scripted.problems
      : await reviewChallengeStep({ scripted, stage });

  const result = await finishFieldChallengeDraftStep({
    ...input,
    model: scripted.provenance.model,
    problems,
    scripted,
  });

  return result.status;
}
