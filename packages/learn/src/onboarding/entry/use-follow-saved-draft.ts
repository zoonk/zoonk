import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { useState } from "react";

/** Two saved copies of a draft say the same: the page reads a new object on each render. */
function isSameDraft(
  next: OnboardingDraftView | null | undefined,
  previous: OnboardingDraftView | null | undefined,
): boolean {
  return JSON.stringify(next ?? null) === JSON.stringify(previous ?? null);
}

/**
 * Follows the page's saved copy of the draft on screen (`initialDraft`) when it changes (another
 * tab corrected it), so confirming here sends what's saved: `follow` shows it. Never over a copy
 * this screen saved or read itself (`markOwn`): no version says which of the two is newer, and the
 * page may have read before that copy was saved. A page copy equal to it means the page caught up,
 * and the screen follows the page again.
 */
export function useFollowSavedDraft({
  follow,
  initialDraft,
  shown,
}: {
  follow: (draft: OnboardingDraftView) => void;
  initialDraft: OnboardingDraftView | null | undefined;
  shown: OnboardingDraftView | null;
}): { markOwn: () => void } {
  const [savedDraft, setSavedDraft] = useState(initialDraft);
  const [ownAhead, setOwnAhead] = useState(false);

  if (!isSameDraft(initialDraft, savedDraft)) {
    setSavedDraft(initialDraft);

    if (initialDraft && shown?.id === initialDraft.id && !ownAhead) {
      follow(initialDraft);
    } else if (initialDraft && shown && isSameDraft(initialDraft, shown)) {
      setOwnAhead(false);
    }
  }

  return { markOwn: () => setOwnAhead(true) };
}
