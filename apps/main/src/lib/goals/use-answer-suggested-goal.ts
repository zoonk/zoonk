"use client";

import { useRouter } from "@/i18n/navigation";
import { getCourseStartHref, getGoalStartHref } from "@/lib/public/public-hrefs";
import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { useCallback } from "react";
import { answerSuggestedGoalAction } from "./suggested-goal-actions";

type SuggestedGoalAnswer = { status: "accepted" | "dismissed"; suggestion: SuggestedGoalView };

/**
 * Records the answer to a suggested goal. Accepting opens the course's start, where the learner
 * picks up the course they were taking, or onboarding with its title once nobody can start that
 * course (as the saved answer says, not the card, which may be older). Dismissing stays on Today, or opens onboarding when the learner has no goal yet
 * (`hasGoal: false`), since Today has nothing else to show them.
 */
export function useAnswerSuggestedGoal({ hasGoal }: { hasGoal: boolean }) {
  const router = useRouter();

  return useCallback(
    async ({ status, suggestion }: SuggestedGoalAnswer): Promise<boolean> => {
      const answered = await answerSuggestedGoalAction({ status, suggestionId: suggestion.id });

      if (!answered) {
        return false;
      }

      if (status === "accepted") {
        router.push(
          answered.courseId
            ? getCourseStartHref({ courseId: answered.courseId })
            : getGoalStartHref(answered.title),
        );

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
