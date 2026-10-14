import { getTutorViewer } from "@/lib/learn/tutor-viewer";
import { findGoalStartLimit } from "@zoonk/core/entitlements/goal-start-limit";
import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { getOnboardingDraft } from "@zoonk/core/view-models/onboarding/get-draft";
import { isUuid } from "@zoonk/utils/uuid";
import { getGoalLimitReason } from "./goal-limit-reason";

/** The draft when it's the learner's own; anyone else's, or none, starts fresh. */
async function loadDraft(draftId: string | null): Promise<OnboardingDraftView | null> {
  if (!draftId || !isUuid(draftId)) {
    return null;
  }

  const result = await getOnboardingDraft({ draftId });
  return result.status === "ready" ? result.draft : null;
}

/**
 * What the start form needs, wherever it shows (`/start`, or Today for a learner without a goal):
 * the buddy who answers questions about attached material, the draft to show again, and the goal
 * limit already reached, if any. A guest whose one goal is taken needs an account first.
 */
export async function loadStartView(draftId: string | null) {
  const [tutor, draft, goalLimit] = await Promise.all([
    getTutorViewer(),
    loadDraft(draftId),
    findGoalStartLimit(),
  ]);

  const isGuestLimit = goalLimit?.tier === "guest";

  return {
    buddy: tutor.buddy,
    canAttach: tutor.canAsk,
    draft,
    goalLimit:
      goalLimit && !isGuestLimit
        ? getGoalLimitReason({ limit: goalLimit, status: "limitReached" })
        : null,
    needsAccount: isGuestLimit,
  };
}
