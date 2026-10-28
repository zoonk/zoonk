import { getAllowanceCacheTag, getGoalsCacheTag } from "@zoonk/core/cache-tags";
import { findGoalStartLimit } from "@zoonk/core/entitlements/goal-start-limit";
import { getSession } from "@zoonk/core/users/session";
import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { getOnboardingDraft } from "@zoonk/core/view-models/onboarding/get-draft";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import { getGoalLimitReason } from "./goal-limit-reason";

async function loadDraft(draftId: string | null): Promise<OnboardingDraftView | null> {
  if (!draftId || !isUuid(draftId)) {
    return null;
  }

  const result = await getOnboardingDraft({ draftId });
  return result.status === "ready" ? result.draft : null;
}

/** Kept for the learner's browser so the page opens from its prefetch; creating a goal checks the limit again. */
export async function loadStartView(draftId: string | null) {
  "use cache: private";

  const session = await getSession();

  if (session) {
    cacheTag(getGoalsCacheTag(session.user.id), getAllowanceCacheTag(session.user.id));
  }

  const [draft, goalLimit] = await Promise.all([loadDraft(draftId), findGoalStartLimit()]);
  const isGuestLimit = goalLimit?.tier === "guest";

  return {
    canAttach: Boolean(session && !session.user.isAnonymous),
    draft,
    goalLimit:
      goalLimit && !isGuestLimit
        ? getGoalLimitReason({ limit: goalLimit, status: "limitReached" })
        : null,
    hasSession: Boolean(session),
    needsAccount: isGuestLimit,
  };
}
