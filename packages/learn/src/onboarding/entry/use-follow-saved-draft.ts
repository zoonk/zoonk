import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { useState } from "react";

function isSameDraft(
  next: OnboardingDraftView | null | undefined,
  previous: OnboardingDraftView | null | undefined,
): boolean {
  return JSON.stringify(next ?? null) === JSON.stringify(previous ?? null);
}

/** Never over a copy this screen saved or read itself (`markOwn`): no version says which is newer. */
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
