"use client";

import { useRouter } from "@/i18n/navigation";
import { getCourseStartHref, getGoalStartHref } from "@/lib/public/public-hrefs";
import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { useStillOnPage } from "@zoonk/ui/hooks/still-here";
import { useCallback } from "react";
import { answerSuggestedGoalAction } from "./suggested-goal-actions";

type SuggestedGoalAnswer = { status: "accepted" | "dismissed"; suggestion: SuggestedGoalView };

/** Goes by the saved answer, not the card, which may be older. */
export function useAnswerSuggestedGoal({ hasGoal }: { hasGoal: boolean }) {
  const router = useRouter();
  const stillOnPage = useStillOnPage();

  return useCallback(
    async ({ status, suggestion }: SuggestedGoalAnswer): Promise<boolean> => {
      const isStillHere = stillOnPage();
      const answered = await answerSuggestedGoalAction({ status, suggestionId: suggestion.id });

      if (!answered) {
        return false;
      }

      if (status === "accepted") {
        if (isStillHere()) {
          router.push(
            answered.courseId
              ? getCourseStartHref({ courseId: answered.courseId })
              : getGoalStartHref(answered.title),
          );
        }

        return true;
      }

      if (hasGoal) {
        router.refresh();
      } else if (isStillHere()) {
        router.push("/start");
      }

      return true;
    },
    [hasGoal, router, stillOnPage],
  );
}
