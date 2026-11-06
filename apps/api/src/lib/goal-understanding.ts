import "server-only";
import { isRunActive } from "@/workflows/_shared/run-activity";
import { startOnce } from "@/workflows/_shared/run-token";
import {
  getGoalUnderstandingToken,
  goalUnderstandingWorkflow,
} from "@/workflows/onboarding/goal-understanding-workflow";
import { getRequestPlatform } from "@zoonk/core/analytics/request-platform";
import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { recordUnderstandingRun } from "@zoonk/core/view-models/onboarding/understanding-run";

export async function isUnderstandingRunning(draft: OnboardingDraftView): Promise<boolean> {
  return (
    draft.status === "understanding" &&
    draft.generationId !== null &&
    (await isRunActive(draft.generationId))
  );
}

/** Saved on the draft right away, so a second start in the meantime follows it. */
export async function startUnderstandingRun(
  draft: OnboardingDraftView,
): Promise<OnboardingDraftView> {
  const runId = await startOnce(
    goalUnderstandingWorkflow,
    [{ draftId: draft.id, platform: await getRequestPlatform() }],
    getGoalUnderstandingToken(draft.id),
  );

  await recordUnderstandingRun({ draftId: draft.id, runId });

  return { ...draft, generationId: runId };
}

export function getUnderstandingLocation(draftId: string): string {
  return `/v1/goal-understandings/${encodeURIComponent(draftId)}`;
}
