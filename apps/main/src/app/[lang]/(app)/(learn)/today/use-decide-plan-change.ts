"use client";

import { answerPlanChangeAction } from "@/app/[lang]/(app)/(learn)/plan/journey-actions";
import { useRouter } from "@/i18n/navigation";
import { toStudyDayDate } from "@/lib/learn/tab-missions";
import { type PlanChangeDecisionInput } from "@zoonk/core/plans/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useCallback } from "react";
import { acknowledgeTodayPlanChangeAction } from "./today-actions";

type Decision = { changeId: string | null; status: PlanChangeDecisionInput["status"] };

/**
 * Answers Today's plan change. A saved one goes through the plan's own answer. "Got it" on one
 * Today worked out before the day saved it (no id yet) saves and acknowledges it in one go, for the
 * day that showed it; saving renders Today again, so it leaves. One out of date by then (the goal
 * paused, the day moved on, the change gone) says nothing: Today reads itself again, and what
 * replaces it shows (`stale`; the notice stays busy until then). Resolves to null when it didn't
 * save, reading Today again when the learner may have moved on elsewhere, so the next try answers
 * what Today shows then.
 */
export function useDecidePlanChange(today: TodayView) {
  const router = useRouter();

  return useCallback(
    async ({ changeId, status }: Decision): Promise<PlanChangeView | "stale" | null> => {
      if (changeId !== null) {
        return answerPlanChangeAction(today.goal.id, { changeId, status });
      }

      const change = today.planChange;

      if (change?.id !== null || status !== "seen") {
        return null;
      }

      const result = await acknowledgeTodayPlanChangeAction({
        goalId: today.goal.id,
        kind: "computed",
        revision: today.revision,
        shownDate: toStudyDayDate(today.session.localDate),
        timeZone: getLocalTimeZone(),
      });

      if (result.status === "acknowledged") {
        return { ...change, id: result.changeId };
      }

      if (result.status === "unauthorized") {
        return null;
      }

      router.refresh();
      return result.status === "retryable" ? null : "stale";
    },
    [router, today],
  );
}
