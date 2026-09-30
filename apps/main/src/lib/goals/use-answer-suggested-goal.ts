"use client";

import { useRouter } from "@/i18n/navigation";
import { getGoalStartHref } from "@/lib/public/public-hrefs";
import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { useCallback } from "react";
import { answerSuggestedGoalAction } from "./suggested-goal-actions";

type SuggestedGoalAnswer = { status: "accepted" | "dismissed"; suggestion: SuggestedGoalView };

/**
 * Records the answer to a suggested goal. Accepting opens onboarding with the course's title as the
 * goal. Dismissing stays on Today, or opens onboarding when the learner has no goal yet
 * (`hasGoal: false`), since Today has nothing else to show them.
 */
export function useAnswerSuggestedGoal({ hasGoal }: { hasGoal: boolean }) {
  const router = useRouter();

  return useCallback(
    async ({ status, suggestion }: SuggestedGoalAnswer): Promise<boolean> => {
      const saved = await answerSuggestedGoalAction({ status, suggestionId: suggestion.id });

      if (!saved) {
        return false;
      }

      if (status === "accepted") {
        router.push(getGoalStartHref(suggestion.title));
        return true;
      }

      if (hasGoal) {
        router.refresh();
        return true;
      }

      router.push("/start");
      return true;
    },
    [hasGoal, router],
  );
}
