import "server-only";
import { type OnboardingDraft } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getAllowanceCacheTag, getOnboardingDraftsCacheTag } from "../../cache/tags";
import { getEntitlementViewer } from "../../entitlements/_utils/entitlement-viewer";
import { claimAssistInWrite } from "../../entitlements/claim-usage";
import { type RefusedUsage, type UsageDecision } from "../../entitlements/contract";
import { findGuestGoalLimit } from "../../entitlements/find-guest-goal-limit";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { completeDraft, findOwnedDraft, loadDraftView } from "./_utils/onboarding-draft";
import { findCompletableUnderstanding } from "./_utils/understanding-cache";
import { type OnboardingDraftView } from "./onboarding-contract";

type Admission =
  | Exclude<UsageDecision, { status: "allowed" }>
  | { claimed: boolean; draft: OnboardingDraft; written: boolean };

export type GoalUnderstandingRunResult =
  | RefusedUsage
  | { status: "notFound" | "unauthorized" }
  | { draft: OnboardingDraftView; status: "start" | "understood" };

/** Requires draft ownership; understood needs no run, start requires one, and a retry claims another small AI allowance once per run that ran. */
export async function prepareGoalUnderstandingRun({
  draftId,
}: {
  draftId: string;
}): Promise<GoalUnderstandingRunResult> {
  const viewer = await getEntitlementViewer();

  if (!viewer) {
    return { status: "unauthorized" };
  }

  const draft = await findOwnedDraft({ draftId, userId: viewer.userId });

  if (!draft) {
    return { status: "notFound" };
  }

  if (draft.status === "understood") {
    return { draft: await loadDraftView(draft), status: "understood" };
  }

  const cached =
    draft.sourceIds.length > 0
      ? null
      : await findCompletableUnderstanding({
          language: draft.language,
          normalizedPrompt: normalizeString(draft.prompt),
          now: new Date(),
          userId: viewer.userId,
        });

  if (cached) {
    const understood = await completeDraft({ draft, exams: [], understanding: cached });

    return { draft: await loadDraftView(understood), status: "understood" };
  }

  const guestLimit = await findGuestGoalLimit();

  if (guestLimit) {
    return { limit: guestLimit, status: "limitReached" };
  }

  const admitted = await writeLearnerChange<Admission>({ userId: viewer.userId }, async (tx) => {
    const current = await tx.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } });

    // A draft whose run never started was paid for by its start; a run that already ran is paid again.
    const needsRun =
      current.status === "failed" || (current.status === "understanding" && current.runId !== null);

    if (!needsRun) {
      return unchanged({ claimed: false, draft: current, written: false });
    }

    const usage =
      current.runId === null ? null : await claimAssistInWrite({ transaction: tx, viewer });

    if (usage && usage.status !== "allowed") {
      return unchanged(usage);
    }

    // Clearing the run means a second retry of the same run, at once, finds nothing left to pay for.
    const ready = await tx.onboardingDraft.update({
      data: { runId: null, status: "understanding" },
      where: { id: draft.id },
    });

    return { claimed: usage !== null, draft: ready, written: true };
  });

  if (!("draft" in admitted)) {
    return admitted;
  }

  if (admitted.written) {
    revalidateCacheTags([
      ...(admitted.claimed ? [getAllowanceCacheTag(viewer.userId)] : []),
      getOnboardingDraftsCacheTag(viewer.userId),
    ]);
  }

  return {
    draft: await loadDraftView(admitted.draft),
    status: admitted.draft.status === "understood" ? "understood" : "start",
  };
}
