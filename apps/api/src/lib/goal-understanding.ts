import "server-only";
import { isRunActive } from "@/workflows/_shared/run-activity";
import { startOnce } from "@/workflows/_shared/run-token";
import {
  getGoalUnderstandingToken,
  goalUnderstandingWorkflow,
} from "@/workflows/onboarding/goal-understanding-workflow";
import { getRequestPlatform } from "@zoonk/core/analytics/request-platform";
import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import {
  type GoalUnderstandingRunResult,
  prepareGoalUnderstandingRun,
} from "@zoonk/core/view-models/onboarding/prepare-understanding-run";
import { recordUnderstandingRun } from "@zoonk/core/view-models/onboarding/understanding-run";

type DraftRun =
  | Exclude<GoalUnderstandingRunResult, { draft: OnboardingDraftView }>
  | { draft: OnboardingDraftView; status: "reading" | "understood" };

async function isUnderstandingRunning(draft: OnboardingDraftView): Promise<boolean> {
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

/** Follows the run still reading a saved draft, or reads it again as a retry does. */
export async function runSavedDraft(draft: OnboardingDraftView): Promise<DraftRun> {
  if (await isUnderstandingRunning(draft)) {
    return { draft, status: "reading" };
  }

  const prepared = await prepareGoalUnderstandingRun({ draftId: draft.id });

  if (!("draft" in prepared)) {
    return prepared;
  }

  if (prepared.status === "understood") {
    return { draft: prepared.draft, status: "understood" };
  }

  return { draft: await startUnderstandingRun(prepared.draft), status: "reading" };
}

export function getUnderstandingLocation(draftId: string): string {
  return `/v1/goal-understandings/${encodeURIComponent(draftId)}`;
}
