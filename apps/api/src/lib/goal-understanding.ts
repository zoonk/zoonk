import "server-only";
import { isRunActive } from "@/workflows/v2/_shared/run-activity";
import { goalUnderstandingWorkflow } from "@/workflows/v2/onboarding/goal-understanding-workflow";
import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { recordUnderstandingRun } from "@zoonk/core/view-models/onboarding/understanding-run";
import { start } from "workflow/api";

/** Whether the draft's words are being read by a run that is still working. */
export async function isUnderstandingRunning(draft: OnboardingDraftView): Promise<boolean> {
  return (
    draft.status === "understanding" &&
    draft.generationId !== null &&
    (await isRunActive(draft.generationId))
  );
}

/**
 * Starts the run that reads a draft's words and keeps it on the draft right away, so a second
 * start in the meantime follows it instead of starting another.
 */
export async function startUnderstandingRun(
  draft: OnboardingDraftView,
): Promise<OnboardingDraftView> {
  const run = await start(goalUnderstandingWorkflow, [{ draftId: draft.id }]);
  await recordUnderstandingRun({ draftId: draft.id, runId: run.runId });

  return { ...draft, generationId: run.runId };
}

export function getUnderstandingLocation(draftId: string): string {
  return `/v1/goal-understandings/${encodeURIComponent(draftId)}`;
}
