import "server-only";
import { normalizeString } from "@zoonk/utils/string";
import { claimAssist } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { findGuestGoalLimit } from "../../entitlements/find-guest-goal-limit";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getSession } from "../../users/get-session";
import { allowDateSearch } from "./_utils/date-search";
import { completeDraft, findOwnedDraft, loadDraftView } from "./_utils/onboarding-draft";
import { findCachedUnderstanding } from "./_utils/understanding-cache";
import { type OnboardingDraftView } from "./onboarding-contract";

export type GoalUnderstandingRunResult =
  | RefusedUsage
  | { status: "notFound" | "unauthorized" }
  | { draft: OnboardingDraftView; status: "start" | "understood" };

/** Requires draft ownership; understood needs no run, start requires one, and retries claim another small AI allowance. */
export async function prepareGoalUnderstandingRun({
  draftId,
}: {
  draftId: string;
}): Promise<GoalUnderstandingRunResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const draft = await findOwnedDraft({ draftId, userId: session.user.id });

  if (!draft) {
    return { status: "notFound" };
  }

  if (draft.status === "understood") {
    return { draft: await loadDraftView(draft), status: "understood" };
  }

  const cached = await findCachedUnderstanding({
    language: draft.language,
    normalizedPrompt: normalizeString(draft.prompt),
    now: new Date(),
    userId: session.user.id,
  });

  if (cached) {
    const understood = await completeDraft({ allowDateSearch, draft, understanding: cached });

    return { draft: await loadDraftView(understood), status: "understood" };
  }

  const guestLimit = await findGuestGoalLimit();

  if (guestLimit) {
    return { limit: guestLimit, status: "limitReached" };
  }

  const usage = draft.runId === null ? null : await claimAssist();

  if (usage && usage.status !== "allowed") {
    return usage;
  }

  const ready =
    draft.status === "failed"
      ? await writeLearnerChange({ userId: session.user.id }, async (tx) => {
          const current = await tx.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } });

          if (current.status !== "failed") {
            return unchanged(current);
          }

          return tx.onboardingDraft.update({
            data: { status: "understanding" },
            where: { id: draft.id },
          });
        })
      : draft;

  return {
    draft: await loadDraftView(ready),
    status: ready.status === "understood" ? "understood" : "start",
  };
}
