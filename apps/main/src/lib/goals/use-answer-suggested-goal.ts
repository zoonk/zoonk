"use client";

import { useRouter } from "@/i18n/navigation";
import { getCourseStartHref, getGoalStartHref } from "@/lib/public/public-hrefs";
import { answerHere, openingHere, stayingHere } from "@/lib/session/tap-answer";
import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { useCallback } from "react";
import { answerSuggestedGoalAction } from "./suggested-goal-actions";

type SuggestedGoalAnswer = { status: "accepted" | "dismissed"; suggestion: SuggestedGoalView };

/** Goes by the saved answer, not the card, which may be older. */
export function useAnswerSuggestedGoal({ hasGoal }: { hasGoal: boolean }) {
  const router = useRouter();

  return useCallback(
    async ({ status, suggestion }: SuggestedGoalAnswer): Promise<boolean> => {
      const refreshesOnly = status === "dismissed" && hasGoal;
      const here = refreshesOnly ? stayingHere() : openingHere();

      const reply = await answerHere(
        answerSuggestedGoalAction({ status, suggestionId: suggestion.id }),
        here,
      );

      // Leaving cancels following the answer; the answer itself still stands.
      if (typeof reply === "boolean") {
        return reply;
      }

      const answered = reply.answer;

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
